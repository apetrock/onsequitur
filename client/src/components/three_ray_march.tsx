import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const ThreeRayMarch: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    // Initialize scene, camera, and renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });

    // Save references to scene, camera, and renderer
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Set up renderer
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Create cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        volume_scale: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        volume_pos: { value: new THREE.Vector3(0.0, 0.0, 0.0) }
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

        in vec3 vray_dir;
        flat in vec3 transformed_eye;

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
            
            vec4 val_color = vec4(p, 0.02);

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

          //gl_FragColor=vec4(p,1.0);
          gl_FragColor=color;
        }
      `
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.scale.set(0.75, 1.0, 1.0);
    cube.position.set(0.0, 0.25, 0.0);
    scene.add(cube);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Set up animation loop
    const animate = (time: number) => {

      requestAnimationFrame(animate);

      // Update cube position
      //cube.rotation.x += 0.01;
      //cube.rotation.y += 0.01;

      // Update shader time
      material.uniforms.time.value = time / 1000;
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

  return <div ref={containerRef} />;
};

export default ThreeRayMarch;