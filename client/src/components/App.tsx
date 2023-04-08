import React from "react";
import ThreeRayMarch from "./three_ray_march";
import ThreeTextureDiffusion from "./three_rd";
import "./App.css";

function App() {
  return (
    <div className="app-container">
      {/*
      <ThreeRayMarch className="Three" />
      */}
      <ThreeTextureDiffusion className="Three" />
    </div>
  );
}

export default App;