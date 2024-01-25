import React, { useState, ChangeEvent } from 'react';

import ThreeRayMarch, { default_transfer } from "./three_ray_march";
import ThreeTextureDiffusion from "./three_rd";
import OffscreenTextInput from './offscreen_text_input';
import "./App.css";

interface TextInputProps {
  onInputChange: (value: string) => void;
  initialText: string;
}

const TextInput: React.FC<TextInputProps> = ({ onInputChange, initialText }) => {
  const [inputValue, setInputValue] = useState<string>(initialText);
  const [isMinimized, setIsMinimized] = useState<boolean>(true);

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    onInputChange(event.target.value);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div >
      <button className='TextInputBtn' onClick={toggleMinimize}>
        {isMinimized ? '▶' : '▼'}
      </button>
      {!isMinimized && (
        <textarea className='TextInput'
          value={inputValue}
          onChange={handleInputChange}
        />
      )}
    </div>
  );
};

function ThreeTextureDiffusionWrapper() {
  return (
    <div className="app-container">
      <ThreeTextureDiffusion className="Three" />
    </div>
  );
}


interface MarchWrapperProps {
  className?: string;
  inputText: string;
  inputCanvas1?: HTMLCanvasElement | null;
  uniqueKey: string;
}
const ThreeRayMarchWrapper: React.FC<MarchWrapperProps> = ({
  className, inputText, inputCanvas1, uniqueKey
}) => {
  return (
    <div className="app-container">
      <ThreeRayMarch className="Three" inputText={inputText} inputCanvas1={inputCanvas1} uniqueKey={uniqueKey} />
    </div>
  );
};

function App() {
  const [data, setData] = useState('');
  const [canvas1, setCanvas1] = useState(null);
  const [uniqueKey, setUniqueKey] = useState('');
  return (
    <div>
      <div>
        <ThreeRayMarchWrapper className="Three" inputText={data} inputCanvas1={canvas1} uniqueKey={uniqueKey} />
        <OffscreenTextInput onCanvas={setCanvas1} onText={setUniqueKey} initialText={"OnSequitur"} />
        <TextInput onInputChange={setData} initialText={default_transfer()} />
      </div>
      <div className='red' style={{ width: '50%', margin: '0 auto', textAlign: 'left' }}>
        <p>
          This is the online portfolio for John Delaney. There's not much here,
          but perhaps that will change.  Eventually I'll blog about Darboux Cyclides and
          least squared quadrics, cylinders and all kinds of exciting geometry stuff, but for now, there's a shader up there.

        </p>
        <p>
          email: "a dot pet dot rock at gmail dot com"
        </p>
      </div>
      {/*<div> <h2>Project 2: Three Texture Diffusion</h2>
        <ThreeTextureDiffusionWrapper /> </div>*/}
    </div>
  );
}

export default App;