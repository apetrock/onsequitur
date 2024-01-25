import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const OffscreenTextInput = ({ onCanvas, onText, initialText = '' }) => {
    const inputRef = useRef(null);
    const canvasRef = useRef(null);
    const currentText = useRef(initialText);

    function fillText(canvas, text) {
        //set font size, font

        let ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.font = "340px ccaps";
        //set text color
        ctx.fillStyle = "white";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        console.log(canvas.id);
        onCanvas(canvas);
        onText(text);
    }

    function initCanvas() {
        //const canvas = document.createElement('canvas');
        const canvas = new OffscreenCanvas(1024, 256);
        canvas.id = "offscreen-canvas";
        canvas.width = 2048;
        canvas.height = 512;

        const ctx = canvas.getContext('2d');
        //init ctx to black
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return canvas;
    }

    useEffect(() => {
        canvasRef.current = initCanvas();
        currentText.current = initialText;
        if (inputRef.current) {
            //5fillText(canvasRef.current, initialText);
            inputRef.current.value = initialText;
            inputRef.current.addEventListener('input', () => {
                fillText(canvasRef.current, inputRef.current.value);
            });

        }

    }, [initialText]);

    useEffect(() => {
        const font = new FontFace('ccaps', 'url(' + process.env.PUBLIC_URL + '/ccaps.ttf)');
        font.load().then((loadedFont) => {
            document.fonts.add(loadedFont);
            fillText(canvasRef.current, currentText.current);
            // Initialize the component here
        }).catch((error) => {
            console.error('Failed to load font', error);
        });
    }, []);

    return (
        <div className='center'>
            <input ref={inputRef} type="text" className='TextInput2' />
            <span className='red'> &lt;---try typing some text!</span>
        </div>
    );
};

export default OffscreenTextInput;