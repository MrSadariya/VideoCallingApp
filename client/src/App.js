import React from 'react';
import {Route,Routes} from 'react-router-dom';
import './App.css';
import RoomPage from './Components/RoomPage';
import HomePage from './Components/HomePage';
import {SocketProvider}from './Contexts/SocketContext';
import {MeContextProvider} from './Contexts/MeContext'

function App() {
  return (
    <>
    <SocketProvider>
    <MeContextProvider>
      
    <Routes>
      <Route path='/' element={<HomePage/>}/>
      <Route path='/room/:id' element={<RoomPage/>}/>
    </Routes>
      
    </MeContextProvider>
    </SocketProvider>

    </>
  );
}

export default App;
