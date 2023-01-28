import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

console.log("IFC MODEL...");
const scene = new THREE.Scene();

//Object to store the size of the viewport
const size = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const fov = 45;
const aspect = 2;  // the canvas default
const near = 0.1;
const far = 1000;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
// make the camera look down
camera.position.set(-30, 30, -30);
camera.up.set(0, 1, 0);
camera.lookAt(0, 0, 0);

//Creates the lights of the scene
const lightColor = 0xffffff;

const ambientLight = new THREE.AmbientLight(lightColor, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(lightColor, 1);
directionalLight.position.set(0, 10, 0);
directionalLight.target.position.set(-5, 0, 0);
scene.add(directionalLight);
scene.add(directionalLight.target);

//Sets up the renderer, fetching the canvas of the HTML
const threeCanvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true,
    antialias: true,
    logarithmicDepthBuffer:true
});

renderer.setSize(size.width, size.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;

// Creates grids and axes in the scene
const grid = new THREE.GridHelper(50, 30);
scene.add(grid);

// const axes = new THREE.AxesHelper(20);
// axes.material.depthTest = false;
// axes.renderOrder = 1;
// scene.add(axes);

//Creates the orbit controls (to navigate the scene)
const controls = new OrbitControls(camera, threeCanvas);
const color = new THREE.Color(0xff9900);

const geometry = new THREE.BoxGeometry( 5, 5, 5);
const boxMaterial = new THREE.MeshLambertMaterial({
    color,
  });
const mesh = new THREE.Mesh( geometry, boxMaterial );
scene.add(mesh);

//* IFC SETUP
const ifcLoader = new IFCLoader();

const ifcModels = [];

const createFile = async (path, name, type) =>{
    let response = await fetch(path);
    let data = await response.blob();
    let metadata = {
        type: type
    };
    const file = new File([data], name, metadata);
    return URL.createObjectURL(file);
};

const loadModel = async()=>{
    await createFile('../wasm/001.ifc', 'file.ifc', 'application/x-step')
    .then((file) => {
        ifcLoader.load(
        file,
        (ifcModel) => {
            ifcModels.push(ifcModel);
            console.log("IFC MODEL...", ifcModel);
            scene.add(ifcModel);
        });
    });
};

loadModel();

//Animation loop
const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
};
animate();
//Adjust the viewport to the size of the browser
window.addEventListener("resize", () => {
    size.width = window.innerWidth;
    size.height = window.innerHeight;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
});
