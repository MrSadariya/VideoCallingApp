import React, { createContext, useContext, useMemo } from "react";
import {io} from 'socket.io-client';

export const SocketContext=createContext(null);

export const SocketProvider=(props)=>{

    const socket = useMemo(()=>io(process.env.REACT_APP_BACKEND_URL),[]);
    
    return(
        <SocketContext.Provider value={{socket}}>
            {props.children}
        </SocketContext.Provider>
    )

}

export const useSocket=()=>{
    return useContext(SocketContext);
}