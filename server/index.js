const express=require('express');
const bodyParser=require('body-parser');
const http=require('http');

const { Server }=require('socket.io');
const { off, emit } = require('process');

const app=express();
const server=http.createServer(app);
const io=new Server(server,{
    cors:{
        origin: "http://localhost:3000", 
        methods: ["GET", "POST"],
    }
});

app.use(bodyParser.json());

const PORT=5000;

const Email_Socket_Mapping=new Map();
const Socket_Email_Mapping=new Map();
const Room_Count = new Map(); 
const User_Room = new Map(); 
const Active_Emails = new Set(); 

const cleanupUserData = (socketId, emailId) => {
    if (emailId) {
        const roomId = User_Room.get(emailId);
        if (roomId) {
            decrementRoomCount(roomId);
            User_Room.delete(emailId);
        }
        Email_Socket_Mapping.delete(emailId);
        Active_Emails.delete(emailId);
    }
    if (socketId) {
        Socket_Email_Mapping.delete(socketId);
    }
};

const incrementRoomCount = (roomId) => {
    const currentCount = Room_Count.get(roomId) || 0;
    Room_Count.set(roomId, currentCount + 1);
    return currentCount + 1;
};

const decrementRoomCount = (roomId) => {
    const currentCount = Room_Count.get(roomId) || 0;
    if (currentCount <= 1) {
        Room_Count.delete(roomId);
    } else {
        Room_Count.set(roomId, currentCount - 1);
    }
    return Math.max(0, currentCount - 1);
};

io.on("connection",(socket)=>{
    console.log("User Connected!! , ID:",socket.id);

    socket.on("disconnect", () => {
        const emailId=Socket_Email_Mapping.get(socket.id);
        if (emailId) {
            const roomId = User_Room.get(emailId);
            cleanupUserData(socket.id, emailId);
        }
        console.log("Disconnected!! ,ID:",socket.id);
      });

    socket.on("req-JoinRoom",data=>{
        const {roomId,EmailId}=data;

        if (Active_Emails.has(EmailId)) {
            io.to(socket.id).emit("notify", {
                message: "This Username is already in use , Try new one!!",type:"error"
            });
            return;
        }

        const currentCount = Room_Count.get(roomId) || 0;
        if (currentCount >= 2) {
            io.to(socket.id).emit("notify", { 
                message: "Room is already full" ,type:"error"
            });
            return;
        }

        incrementRoomCount(roomId);
        Active_Emails.add(EmailId);
        Email_Socket_Mapping.set(EmailId,socket.id);
        Socket_Email_Mapping.set(socket.id,EmailId);
        User_Room.set(EmailId, roomId);

        console.log("User ",EmailId," joined room:",roomId);
        io.to(roomId).emit('new-userJoined',{newUserEmail:EmailId});
        socket.join(roomId);
        io.to(socket.id).emit("acc-JoinedRoom",{MeEmail:EmailId,roomId});
    })

    socket.on('call-user-sdp',data=>{
        const {emailId,sdpOffer}=data;
        const fromEmail=Socket_Email_Mapping.get(socket.id);
        const toEmail=emailId;
        io.to(Email_Socket_Mapping.get(emailId)).emit('incoming-call-sdp',{fromEmail,sdpOffer});

    })

    socket.on('call-accepted-sdp',data=>{
        const {toEmail,ans}=data;
        const fromEmail=Socket_Email_Mapping.get(socket.id);
        io.to(Email_Socket_Mapping.get(toEmail)).emit('call-accepted-ans-sdp',{fromEmail,ans});
    })

    socket.on('peer-nego-needed',data=>{
        const {toEmail,offer}=data;
        io.to(Email_Socket_Mapping.get(toEmail)).emit('peer-nego-needed',{fromSocketId:socket.id,offer});
    })

    socket.on('peer-nego-done',data=>{
        const {toSocketId,ans}=data;
        io.to(toSocketId).emit('peer-nego-final',{fromSocketId:socket.id,ans});
    })

    socket.on('send-your-streams',data=>{
        const {toEmail}=data;
        io.to(Email_Socket_Mapping.get(toEmail)).emit('send-your-stream-remote',{fromEmail:toEmail});
    })

    socket.on('ice-candidates',data=>{
        const {candidates,toEmail}=data;
        io.to(Email_Socket_Mapping.get(toEmail)).emit('new-ice-candidates',{candidates})
    })

    socket.on("user-disconnected",data=>{
        const {roomId,leftEmail}=data;
        if (leftEmail) {
            const leftSocketId = Email_Socket_Mapping.get(leftEmail);
            cleanupUserData(leftSocketId, leftEmail);
            
            if (leftSocketId) {
                io.sockets.sockets.get(leftSocketId)?.disconnect(true);
            }
            io.to(roomId).emit("user-disconnected", { roomId, leftEmail });
        }
    })

    socket.on("toggle",data=>{
        const {toEmail,type,value}=data;
        io.to(Email_Socket_Mapping.get(toEmail)).emit('toggle-remote',{type,value})
    })
})

server.listen(PORT,()=>{
    console.log("Socket-Server running at PORT:",PORT);
})

