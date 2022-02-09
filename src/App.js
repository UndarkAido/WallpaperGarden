import './App.css';
import {Outlet} from "react-router-dom";
import AppBar from "./components/AppBar";
import React from "react";

function App() {
    return (
        <div className="App">
            <AppBar/>
            <Outlet/>
        </div>
    );
}

export default App;
