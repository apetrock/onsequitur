import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

function default_transfer() {
  return `
  /////////////////////////////////////////////
  //internally defined uniforms:
  //
  //uniform float time;
  //uniform highp sampler2D tex0; //onsequitur.png
  //uniform highp sampler2D tex1; //not used
  //uniform highp sampler2D tex2; //not used
  //PI is defined
  /////////////////////////////////////////////
  
  vec4 transfer_fcn(vec3 pos) {

    float d = pos.z;
    float dp = pow(pos.z, 3.0);
    float x = pos.x;
    float y = pos.y;
    float t = time;
    
    
    t = triangle(t, 4000.0);
    //t = easeInOutElastic(t);
    y = (y - 0.5)* (1.0 + 0.1*sin(8.0 * PI * x + PI*t)) + 0.5;
    y *= 1.1;
    vec4 tex = texture(tex1, vec2(x,y));
    float r = length(tex.xyz);
    //can't figure out why there is an artifact at the top,
    //so we'll clip it out
    r = pos.y > 0.98 ? 0.0 : r;
    vec3 color = rainbowColor(1.0 - d);
    color = d > 0.95 ? vec3(1.0) : color;
    return vec4(color, 0.1*r*dp);
  }
  `
}

let ThreeRayMarch = ({ className, inputText, inputCanvas1, uniqueKey }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cubeRef = useRef(null);
  const tex0Ref = useRef(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(process.env.PUBLIC_URL + '/onsequitur.png', (texture) => {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      tex0Ref.current = texture;
      update_textures();
    });
  }, []);

  function update_textures() {
    if (tex0Ref.current && cubeRef.current) {
      cubeRef.current.material.uniforms.tex0.value = tex0Ref.current;
      cubeRef.current.material.needsUpdate = true;
    }
  }

  function build_volume_material(input_transfer_fcn) {
    const bitmapTexture0 = new THREE.TextureLoader().load(process.env.PUBLIC_URL + '/onsequitur.png');
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        volume_scale: { value: new THREE.Vector3(8.0, 2.0, 2.0) },
        volume_pos: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
        tex0: bitmapTexture0,
        tex1: { value: null },
      },
      vertexShader: `
        #ifdef GL_ES
        precision highp float;
        #endif
        uniform float time;

        //uniform vec3 eye_pos;
        uniform vec3 volume_scale;
        uniform vec3 volume_pos;

        out vec3 vray_dir;
        flat out vec3 transformed_eye;

        void main(void) {
          // Translate the cube to center it at the origin.
          vec3 eye_pos = cameraPosition;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);

          // Compute eye position and ray directions in the unit cube space
          transformed_eye = (eye_pos ) / volume_scale + vec3(0.5) - volume_pos;
          vray_dir = position + vec3(0.5) - transformed_eye;
        }
      `,
      fragmentShader: `

        precision highp int;
        precision highp float;
        uniform float time;

        //uniform highp sampler3D volume;
        // WebGL doesn't support 1D textures, so we use a 2D texture for the transfer function
        //uniform highp sampler2D transfer_fcn;
        //uniform ivec3 volume_dims;
        uniform sampler2D tex0;
        uniform sampler2D tex1;
        uniform sampler2D tex2;

        in vec3 vray_dir;
        flat in vec3 transformed_eye;
              
        #define PI 3.14159265358979323846
        
        float sawtooth(float x, float period) {
          return (x / period) - floor(x / period);
        }
        float triangle(float x, float period) {
          return abs(sawtooth(x, period) - 0.5) * 2.0;
        }
        vec3 rainbowColor(float value) {
          float red = sin(value * 2.0 * PI);
          float green = sin(value * 2.0 * PI + 2.0 * PI / 3.0);
          float blue = sin(value * 2.0 * PI + 4.0 * PI / 3.0);
          return vec3(red, green, blue) * 0.5 + 0.5; // Scale and shift to [0, 1]
        }

        float easeInOutElastic(float x) {
          float c5 = (2.0 * PI) / 4.5;
          
          return x == 0.0
            ? 0.0
            : x == 1.0
            ? 1.0 
            : x < 0.5
            ? -(pow(2.0, 20.0 * x - 10.0) * sin((20.0 * x - 11.125) * c5)) / 2.0
            : (pow(2.0, -20.0 * x + 10.0) * sin((20.0 * x - 11.125) * c5)) / 2.0 + 1.0;
        }

        //random number generator 
        float rand(vec2 co){
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        ${input_transfer_fcn}

        vec2 intersect_box(vec3 orig, vec3 dir) {
          const vec3 box_min = vec3(0);
          const vec3 box_max = vec3(1);
          vec3 inv_dir = 1.0 / dir;
          vec3 tmin_tmp = (box_min - orig) * inv_dir;
          vec3 tmax_tmp = (box_max - orig) * inv_dir;
          vec3 tmin = min(tmin_tmp, tmax_tmp);
          vec3 tmax = max(tmin_tmp, tmax_tmp);
          float t0 = max(tmin.x, max(tmin.y, tmin.z));
          float t1 = min(tmax.x, min(tmax.y, tmax.z));
          return vec2(t0, t1);
        }

        void main(void) {
          //gl_FragColor=vec4(vray_dir,1.0);
          //return;
          // Step 1: Normalize the view ray
          vec3 ray_dir = normalize(vray_dir);

          // Step 2: Intersect the ray with the volume bounds to find the interval
          // along the ray overlapped by the volume.
          vec2 t_hit = intersect_box(transformed_eye, ray_dir);
          if (t_hit.x > t_hit.y) {
            discard;
          }
          // We don't want to sample voxels behind the eye if it's
          // inside the volume, so keep the starting point at or in front
          // of the eye
          t_hit.x = max(t_hit.x, 0.0);

          ivec3 volume_dims = ivec3(100);
          
          // Step 3: Compute the step size to march through the volume grid
          vec3 dt_vec = 1.0 / (vec3(volume_dims) * abs(ray_dir));
          float dt = min(dt_vec.x, min(dt_vec.y, dt_vec.z));

          // Step 4: Starting from the entry point, march the ray through the volume
          // and sample it
          vec3 p = transformed_eye + t_hit.x * ray_dir;
          //gl_FragColor= vec4(p, 1.00);
          //return;
          vec4 color = vec4(0.0);
          
          for (float t = t_hit.x; t < t_hit.y; t += dt) {
            // Step 4.1: Sample the volume, and color it by the transfer function.
            // Note that here we don't use the opacity from the transfer function,
            // and just use the sample value as the opacity
            //float val = texture(volume, p).r;
            //vec4 val_color = vec4(texture(transfer_fcn, vec2(val, 0.5)).rgb, val);
            
            vec4 val_color = transfer_fcn(p);

            // Step 4.2: Accumulate the color and opacity using the front-to-back
            // compositing equation
            color.rgb += (1.0 - color.a) * val_color.a * val_color.rgb;
            color.a += (1.0 - color.a) * val_color.a;

            // Optimization: break out of the loop when the color is near opaque
            if (color.a >= 0.95) {
              break;
            }
            p += ray_dir * dt;
          }

          //TODO: placeholder black background
          //      replace with input texture for background
          vec4 background = vec4(0.0, 0.0, 0.0, 1.0);
          //background = texture(tex0, gl_FragCoord.xy / vec2(512.0, 512.0));
          gl_FragColor= color + (1.0 - color.a) * background;
        }
      `
    });

    return material;
  }

  useEffect(() => {

    const scale = new THREE.Vector3(8.0, 2.0, 2.0);
    const position = new THREE.Vector3(0.0, 0.0, 0.0);

    const container = containerRef.current;

    if (!container) {
      return;
    }

    // Initialize scene, camera, and renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Set up renderer
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Create cube
    let material = build_volume_material(default_transfer());

    const geometry = new THREE.BoxGeometry();
    const cube = new THREE.Mesh(geometry, material);

    cube.scale.set(scale.x, scale.y, scale.z);
    cube.position.set(position.x, position.y, position.z);
    scene.add(cube);
    cubeRef.current = cube;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Set up animation loop
    const animate = (time) => {

      requestAnimationFrame(animate);

      material = cubeRef.current.material;
      material.uniforms.time.value = time;
      material.uniforms.volume_scale.value = cube.scale;
      material.uniforms.volume_pos.value = cube.position;
      // Render scene
      renderer.render(scene, camera);
    };
    animate(0);

    // Clean up
    return () => {
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);


  useEffect(() => {
    if (inputText) {
      // Update cube when input text changes
      console.log("inputText changed", inputText);
      let ctime = cubeRef.current.material.uniforms.time.value;
      let material = build_volume_material(inputText);
      cubeRef.current.material = material;
      cubeRef.current.material.uniforms.time.value = ctime;

      update_textures();
    }
  }, [inputText]);


  useEffect(() => {
    if (inputCanvas1 || uniqueKey) {

      const texture = new THREE.CanvasTexture(inputCanvas1);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      cubeRef.current.material.uniforms.tex1.value = texture;
      cubeRef.current.material.needsUpdate = true;
      update_textures();
    }
  }, [inputCanvas1, uniqueKey]);

  return <div ref={containerRef} />;
};

export default ThreeRayMarch;
export { default_transfer };