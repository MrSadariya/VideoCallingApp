import React, { useEffect,useCallback,useState ,useRef, useContext} from "react";
import {useNavigate, useParams} from 'react-router-dom';
import {useSocket} from '../Contexts/SocketContext';
// import ReactPlayer from 'react-player';
import peer from '../service/PeerService';
import './RoomPage.css';
import {MeContext} from '../Contexts/MeContext'
import {Video, Mic, PhoneOff,VideoOff,MicOff} from 'lucide-react'
import {Toaster,toast} from 'react-hot-toast'

const RoomPage=()=>{

    const {socket}=useSocket();

    const {me,setMe}=useContext(MeContext);
    const polite=useRef(true);
    const makingOffer=useRef(false);
    const ignoreOffer = useRef(false);

    const [meStream,setMeStream]=useState(null);
    
    const [remoteEmailId,setRemoteEmailID]=useState(null);
    const [remoteStream,setRemoteStream]=useState(null);

    const [isVideo,setisVideo]=useState(true);
    const [isMic,setisMic]=useState(true);

    const navigate=useNavigate();
    
    const {id}=useParams();

    const meVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const handlegetUserMedia=useCallback(async ()=>{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
        setMeStream(stream);
        meVideoRef.current.srcObject = stream;

        for(const track of stream.getTracks()){
            peer.peer.addTrack(track, stream);
        }
    },[])

    const handleNewUserJoin=useCallback(async(data)=>{

        polite.current=false;
        
        const {newUserEmail}=data;
        const sdpOffer=await peer.createOfferSdp();
        
        socket.emit('call-user-sdp',{emailId:newUserEmail,sdpOffer});
        // console.log("User :",newUserEmail," joined your room");
        setRemoteEmailID(newUserEmail);
    
    },[socket])

    const handleIncomingSDPCall=useCallback(async(data)=>{

        const {fromEmail,sdpOffer}=data;
        const ans=await peer.createAnswerSdp(sdpOffer);
        
        socket.emit('call-accepted-sdp',{toEmail:fromEmail,ans});
        // console.log("User ",fromEmail," calling you with sdp:",sdpOffer);
        setRemoteEmailID(fromEmail);
    },[socket])

    const handleAcceptedSDPCall=useCallback(async (data)=>{
        const {fromEmail,ans}=data;
        
        await peer.setAnswerAsRemote(ans);
        // console.log("Your Call got accepted and here is their answer:",ans);

    },[])

    
    const handleTracks=useCallback((ev)=>{
        // console.log("New Tracks",ev.streams[0]);
        setRemoteStream(ev.streams[0]);
        remoteVideoRef.current.srcObject = ev.streams[0];
    },[])

    const handleNegoNeeded=useCallback(async ()=>{
        // console.log("Nego Needed!");
        try{
            makingOffer.current=true;
            await peer.peer.setLocalDescription();
            socket.emit("peer-nego-needed",{toEmail:remoteEmailId,offer:peer.peer.localDescription});
            // console.log("Polite:",polite.current)
            // console.log("Nego Started and Offer Sent to:",remoteEmailId);
        }catch(err){
            console.log("Error while Nego0:",err);
        }finally{
            makingOffer.current=false;
        }
        
    },[remoteEmailId, socket])

    const handleNegoIncoming=useCallback(async (data)=>{
        const {fromSocketId,offer}=data;
        try{
            const collosion=(makingOffer.current || peer.peer.signalingState!=='stable')

            ignoreOffer.current=(!polite.current && collosion);
            if(ignoreOffer.current){
                // console.log("Offer Gets from Other User but rejected!!");
                return;
            }
            
            const ans=await peer.createAnswerSdp(offer);
            socket.emit('peer-nego-done', {toSocketId: fromSocketId,ans});
            // console.log("Polite:",polite.current)
            // console.log("Accepted offer from other User and ans sent to:",remoteEmailId)
            
            
        }catch(err){
            console.log("Error1:",err);
        }
    },[socket])

    const handleNegoFinal=useCallback(async (data)=>{
        const {ans}=data;
        await peer.setAnswerAsRemote(ans);
        
    },[])

    const handleNewICECandidates=useCallback(async (data)=>{
        const {candidates}=data;
        if(peer.peer.remoteDescription){
            await peer.peer.addIceCandidate(candidates);
        }
    },[])

    const handleOnIceCandidate=useCallback((ev)=>{
        if(ev.candidate){
            socket.emit('ice-candidates',{candidates:ev.candidate,toEmail:remoteEmailId})
        }
    },[remoteEmailId, socket])

    useEffect(()=>{
        peer.peer.addEventListener('track',handleTracks);

        return()=>{
            peer.peer.removeEventListener('track',handleTracks);
        }

    },[handleTracks])


    useEffect(()=>{
            peer.peer.addEventListener('icecandidate',handleOnIceCandidate);

            return()=>{
                peer.peer.removeEventListener('icecandidate',handleOnIceCandidate); 
            }
    },[handleOnIceCandidate])

    useEffect(()=>{
            peer.peer.addEventListener('negotiationneeded',handleNegoNeeded);
        
            return()=>{
                peer.peer.removeEventListener('negotiationneeded',handleNegoNeeded);
            }
    },[handleNegoNeeded])

    

    const toggleVideo=async ()=>{
        if (!meStream) return; 

        const videoTrack = meStream.getVideoTracks()[0]; 
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setisVideo(videoTrack.enabled);
            socket.emit('toggle',{toEmail:remoteEmailId,type:'video',value:videoTrack.enabled});
        }

    }

    const toggleMic=async ()=>{
        if (!meStream) return; 

        const audioTrack = meStream.getAudioTracks()[0]; 
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setisMic(audioTrack.enabled);
            socket.emit('toggle',{toEmail:remoteEmailId,type:'audio',value:audioTrack.enabled});
        }

    }

    const handleHangUp=async()=>{

        if (meStream) {
            meStream.getTracks().forEach(track => track.stop());
        }

        peer.peer.close(); 

        setMeStream(null);
        setRemoteStream(null);
        setRemoteEmailID(null);

        socket.emit("user-disconnected", {roomId:id, leftEmail: me }); 

        navigate('/');
    }

    const handleRemoteUserDisconnect=useCallback(async()=>{
        toast(`User:${remoteEmailId} left the room!!`);
        setRemoteStream(null);
        setRemoteEmailID(null);
        remoteVideoRef.current.srcObject = null;
    },[remoteEmailId])

    const handleToggleRemote=useCallback((data)=>{
        if(!remoteStream){
            return;
        }
        const {type,value}=data;
        if(type==='video'){
            const videoTrack = remoteStream.getVideoTracks()[0]; 
            if (videoTrack) {
                videoTrack.enabled =value;
            }

        } 
        if(type==='audio'){

            const audioTrack = remoteStream.getAudioTracks()[0]; 
            if (audioTrack) {
                audioTrack.enabled = value;
            }
            
        }

    },[remoteStream])

    useEffect(()=>{
        handlegetUserMedia();
    },[handlegetUserMedia])

    useEffect(()=>{
        socket.on('new-userJoined',handleNewUserJoin);
        socket.on('incoming-call-sdp',handleIncomingSDPCall);
        socket.on('call-accepted-ans-sdp',handleAcceptedSDPCall);
        socket.on('peer-nego-needed',handleNegoIncoming);
        socket.on('peer-nego-done',handleNegoFinal);
        // socket.on('send-your-stream-remote',handleSendStream);
        socket.on('new-ice-candidates',handleNewICECandidates);
        socket.on("user-disconnected",handleRemoteUserDisconnect);
        socket.on('toggle-remote',handleToggleRemote);
       
        return ()=>{
            socket.off('new-userJoined',handleNewUserJoin);
            socket.off('incoming-call-sdp',handleIncomingSDPCall);
            socket.off('call-accepted-ans-sdp',handleAcceptedSDPCall);
            socket.off('peer-nego-needed',handleNegoIncoming);
            socket.off('peer-nego-done',handleNegoFinal);
            // socket.off('send-your-stream-remote',handleSendStream);
            socket.off('new-ice-candidates',handleNewICECandidates);
            socket.off("user-disconnected",handleRemoteUserDisconnect);
            socket.off('toggle-remote',handleToggleRemote);
        }
        
    },[handleAcceptedSDPCall, handleIncomingSDPCall, handleNegoFinal, handleNegoIncoming, handleNewICECandidates, handleNewUserJoin, handleRemoteUserDisconnect, handleToggleRemote, socket])

    return(
        <div className="room-container">
        <div className="room-header">
          <h2>Room ID: {id}</h2>
        </div>
    
        <div className="video-grid">
          <div className="video-container">
            <video ref={meVideoRef} alt="Video placeholder" className="video-placeholder" autoPlay />
            <div className="user-name">{me}</div>
          </div>
    
          <div className="video-container">
            <video ref={remoteVideoRef} alt="Video placeholder" className="video-placeholder" autoPlay/>
            <div className="user-name">{remoteEmailId}</div>
          </div>
        </div>
    
        <div className="controls-container">
          <button className="control-button" onClick={toggleVideo}>
            {isVideo?<Video size={24} strokeWidth={2}/>:<VideoOff size={24} strokeWidth={2}/>}
             
          </button>
          <button className="control-button" onClick={toggleMic}>
            {isMic? <Mic size={24} />:<MicOff size={24}/>}
          </button>
          <button className="control-button hangup" onClick={handleHangUp}>
             <PhoneOff size={24} />
          </button>
        </div>

        <Toaster position="top-center" toastOptions={{duration: 4000}} />
      </div>
    )
}

export default RoomPage;