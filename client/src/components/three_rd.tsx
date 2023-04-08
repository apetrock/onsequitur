import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

class Diffuser {
  private texture1: THREE.WebGLRenderTarget;
  private texture2: THREE.WebGLRenderTarget;
  private plane: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private resolution: THREE.Vector2;
  private scene: THREE.Scene;
  private uniforms: any;

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
        // Pressure solver
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
          float t1 = (t0 + a * (tpx + tmx + tpy + tmy))/(1.0 + 4.0 * a);

          gl_FragColor = vec4(t1,0,0,1); // assign a highp 4-component vector of float to gl_FragColor
        }
      `,
    });
    this.plane = new THREE.Mesh(geometry, this.material);
    this.scene = new THREE.Scene();
    this.scene.add(this.plane);
  }

  init(tex0) {
    const createRenderTarget = (width, height) => {
      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
      });
      return renderTarget;
    }
    const width = tex0.source.data.width;
    const height = tex0.source.data.height;

    this.texture1 = createRenderTarget(width, height);
    this.texture2 = createRenderTarget(width, height);
    this.uniforms.tex.value = tex0;
    this.uniforms.resolution.value = new THREE.Vector2(width, height);
  }

  private swapTextures() {
    this.uniforms.tex.value = this.texture2.texture;
    [this.texture1, this.texture2] = [this.texture2, this.texture1];
  }

  public diffuse(renderer, camera) {
    for (var i = 0; i < 10; i++) {
      renderer.setRenderTarget(this.texture2);
      renderer.render(this.scene, camera);
      this.swapTextures();
    }
    renderer.setRenderTarget(null);
    return this.texture1.texture;
  }

}

interface ThreeTextureDiffusionProps {
  className?: string;
}

const ThreeTextureDiffusion: React.FC<ThreeTextureDiffusionProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderer = useRef<THREE.WebGLRenderer>();
  const scene = useRef<THREE.Scene>();
  const camera = useRef<THREE.PerspectiveCamera>();
  const textureSize = useRef(new THREE.Vector2(256, 256));

  const diffuser = useRef<Diffuser>(new Diffuser());

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

  const renderUniforms = useRef({ tex: { value: null }, });

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }
    const dataTexture = initDataTexture(textureSize.current.x, textureSize.current.y);

    renderer.current = new THREE.WebGLRenderer({ antialias: true });
    scene.current = new THREE.Scene();
    camera.current = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.current.position.z = 5;
    renderer.current.setPixelRatio(window.devicePixelRatio);

    renderer.current.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.current.domElement);

    diffuser.current.init(dataTexture);
    renderUniforms.current.tex.value = dataTexture;

    const material = new THREE.ShaderMaterial({
      uniforms: renderUniforms.current,
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
    scene.current.add(quad);
    animate()
    return () => {
      container.removeChild(renderer.current.domElement);
      renderer.current.dispose();
    };
  }, []);

  const animate = () => {
    requestAnimationFrame(animate);
    diffuse();
    renderer.current.render(scene.current, camera.current);
  };

  const diffuse = () => {
    renderUniforms.current.tex.value =
      diffuser.current.diffuse(renderer.current, camera.current);
  };

  return <div ref={containerRef} />;
};

export default ThreeTextureDiffusion;