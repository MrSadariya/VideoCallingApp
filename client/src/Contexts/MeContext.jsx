import React, { createContext,useState } from "react";

export const MeContext=createContext(null);

export const MeContextProvider=(props)=>{

    const [me,setMe]=useState("");

    return(
        <MeContext.Provider value={{me,setMe}}>
            {props.children}
        </MeContext.Provider>
    )

}
