import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';



class Renderer {

  constructor(width, height) {
    this.textureSize = new THREE.Vector2(256, 256);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);


    const material = new THREE.ShaderMaterial({
      uniforms: this.renderUniforms,
      vertexShader: `
      varying vec2 vUv;

      void main() {
        gl_Position = vec4(position, 1.0);
        vUv = uv; // pass uv coordinates to the fragment shader
      }
    `,
      fragmentShader: `
      precision highp float;
      uniform sampler2D tex;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tex, vUv);
        gl_FragColor = vec4(color.xyz, 1.0); // assign a highp 4-component vector of float to gl_FragColor
      }
    `,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    this.scene.add(quad);
  }

  getDomElement() { return this.renderer.domElement; }

  setTexture(tex) {
    this.renderUniforms.tex.value = tex;
  }

  getTexture() {
    return this.renderUniforms.tex.value;
  }

  getCamera() { return this.camera; }
  getRenderer() { return this.renderer; }
  dispose() { this.renderer.dispose(); }

  render() {
    this.renderer.render(this.scene, this.camera);
  };
}

class Diffuser {

  constructor() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.uniforms = {
      tex: { value: null },
      delta: { value: 0.5 },
      resolution: { value: new THREE.Vector2(1.0, 1.0) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          gl_Position = vec4( position, 1.0 );
          vUv = uv; // pass uv coordinates to the fragment shader
        }
      `,

      fragmentShader: `

        precision highp float;
        uniform sampler2D tex;
        uniform float delta;
        uniform vec2 resolution;

        varying vec2 vUv;

        float rhs(int x,int y){
          vec2 p = vUv + delta * vec2(x,y) / resolution;
          return texture(tex,p).x;
        }

        void main() {

          float tmx = rhs(-1,0);
          float tpx = rhs(1,0);
          float tmy = rhs(0,-1);
          float tpy = rhs(0,1);

          float t0 = rhs(0,0);
          float a = 0.1;
          //t1 - t0 =  a * (tpx + tmx + tpy + tmy - 4.0 * t1);
          //t1 - t0 =  a * (tpx + tmx + tpy + tmy - 4.0 * t0);
          //t1 - t0 =  0.5 * a * (tpx + tmx + tpy + tmy - 4.0 * t0) +
          //           0.5 * a * (tpx + tmx + tpy + tmy - 4.0 * t1);
          //t1 - t0 =  a * (tpx + tmx + tpy + tmy - 2.0 * t0 - 2.0 * t1);

          float t1 = (t0 + a * (tpx + tmx + tpy + tmy - 2.0 * t0))/(1.0 + 2.0 * a);
          gl_FragColor = vec4(t1,0,0,1); // assign a highp 4-component vector of float to gl_FragColor
        }
      `,
    });
    this.plane = new THREE.Mesh(geometry, this.material);
    this.scene = new THREE.Scene();
    this.scene.add(this.plane);
  }

  init(width, height) {
    const createRenderTarget = (width, height) => {
      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
      });
      return renderTarget;
    }
    this.texture1 = createRenderTarget(width, height);
    this.texture2 = createRenderTarget(width, height);
    this.uniforms.resolution.value = new THREE.Vector2(width, height);
  }

  swapTextures() {
    this.uniforms.tex.value = this.texture2.texture;
    [this.texture1, this.texture2] = [this.texture2, this.texture1];
  }

  diffuse(tex, renderObj) {
    //this.uniforms.delta.value = 4.0;
    this.uniforms.tex.value = tex;
    const renderer = renderObj.getRenderer();
    const camera = renderObj.getCamera();
    for (var i = 0; i < 20; i++) {
      renderer.setRenderTarget(this.texture2);
      renderer.render(this.scene, camera);
      //this.uniforms.delta.value /= 1.5;
      this.swapTextures();
    }
    renderer.setRenderTarget(null);
    return this.texture1.texture;
  }

}

const ThreeTextureDiffusion = ({ className }) => {
  const containerRef = useRef(null);
  const textureSize = useRef(new THREE.Vector2(256, 256));

  const diffuser = useRef(new Diffuser());
  const renderer = useRef(null);

  const initDataTexture = (width, height) => {
    const data = new Float32Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i + 0] = Math.random()
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 1;
    }

    const textureData = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    textureData.needsUpdate = true;
    return textureData;
  };


  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    renderer.current = new Renderer(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.current.getDomElement());

    diffuser.current.init(textureSize.current.x, textureSize.current.y);
    const dataTexture = initDataTexture(textureSize.current.x, textureSize.current.y);
    renderer.current.setTexture(dataTexture);

    const animate = () => {
      requestAnimationFrame(animate);
      diffuse();
      renderer.current.render();
    };

    animate()
    return () => {
      container.removeChild(renderer.current.getDomElement());
      renderer.current.dispose();
    };
  }, []);



  const diffuse = () => {
    renderer.current.setTexture(
      diffuser.current.diffuse(
        renderer.current.getTexture(),
        renderer.current
      ));
  };

  return <div ref={containerRef} />;
};

export default ThreeTextureDiffusion;