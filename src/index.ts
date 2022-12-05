import { KeyDisplay } from './utils';
import { CharacterControls } from './characterControls';
import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry'
import * as CANNON from 'cannon';
import CannonDebugRenderer from './cannonDebugRenderer';
import CannonUtils from './cannonUtils';
// import { GUI }  from 'dat.gui';
const { GUI } = require('dat.gui');
import Vec3 = CANNON.Vec3;


// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0);

// CAMERA
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 5;
camera.position.x = 0;

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true

// CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true
orbitControls.minDistance = 5
orbitControls.maxDistance = 15
orbitControls.enablePan = false
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
orbitControls.minPolarAngle = 1.2;
orbitControls.maxAzimuthAngle = orbitControls.minAzimuthAngle = 0;
orbitControls.enableZoom = false;
orbitControls.update();

// LIGHTS
light()

// FLOOR
generateFloor()

// Material
const objectMaterial = new CANNON.Material('groundMaterial')
objectMaterial.friction = 0.25
objectMaterial.restitution = 0.25

const humanMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.05,
    metalness: 0.54,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
})

// WORLD
const world = new CANNON.World()
world.gravity.set(0, -9.82, 0); // set gravity

//Shellter
new GLTFLoader().load('models/bunkerwithoutdoors_untitled.glb', function (gltf) {
    const model = gltf.scene;
    const objectBody = new CANNON.Body({ mass: 0, material: objectMaterial });
    const objectShape: any[] = [];
    model.traverse(function (object: any) {
        if (object.isMesh) {
            console.log(object);
            object.receiveShadow = true;
            object.material = objectMaterial; //new
            // objectShape.push(getShapeFromMesh(object));  //new
        }
    });
    // model.position.setY(0)
    // model.position.setX(0.1)
    // model.position.setZ(0)
    // for(var i =0;i < objectShape.length; i++)
    // objectBody.addShape(objectShape[i]);

    objectBody.position.z = -16;    // new
    objectBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI); //new

    model.rotation.y = Math.PI;
    model.position.z = -16;

    model.scale.set(.7, .7, .7);
    world.addBody(objectBody);     // new
    scene.add(model);
});


// MODEL WITH ANIMATIONS
var characterControls: CharacterControls
new GLTFLoader().load('models/homeless2.glb', function (gltf) {
    let humanBody = new CANNON.Body({ mass: 0, material: objectMaterial });
    let humanShape: CANNON.Shape;
    const model = gltf.scene;
    console.log("Model\n", model);
    model.traverse(function (object: any) {
        if (object.isMesh) {
            object.castShadow = true;
            // object.material = humanMaterial;
            humanShape = ShapeFromMesh(object);
            console.log(humanShape);
            humanBody.addShape(humanShape);
        }
    });
    model.position.setY(0.1)
    model.scale.set(1, 1, 1);


    world.addBody(humanBody);
    scene.add(model);
    // console.log(model);
    console.log(gltf);
    const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
    const mixer = new THREE.AnimationMixer(model);
    const animationsMap: Map<string, THREE.AnimationAction> = new Map()
    gltfAnimations.filter(a => a.name != 'Armature|mixamo.com|Layer0').forEach((a: THREE.AnimationClip) => {
        animationsMap.set(a.name, mixer.clipAction(a));
        console.log(a.name)
    })

    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, 'idle')
    // model.position.z = 62;
    // camera.position.z = 69;


});

// CONTROL KEYS
const keysPressed = {}
const keyDisplayQueue = new KeyDisplay();
document.addEventListener('keydown', (event) => {


    if (event.key == ' ') {
        characterControls.jump();
        //    console.error( characterControls.model.position.z,camera.position.z);
    }
    keyDisplayQueue.down(event.key)
    if (event.shiftKey && characterControls) {
        characterControls.switchRunToggle()
    } else {
        (keysPressed as any)[event.key.toLowerCase()] = true
    }
}, false);
document.addEventListener('keyup', (event) => {

    keyDisplayQueue.up(event.key);
    (keysPressed as any)[event.key.toLowerCase()] = false
}, false);

const stats = Stats()
document.body.appendChild(stats.dom)

const gui = new GUI()
const physicsFolder = gui.addFolder('Physics')
physicsFolder.add(world.gravity, 'x', -10.0, 10.0, 0.1)
physicsFolder.add(world.gravity, 'y', -10.0, 10.0, 0.1)
physicsFolder.add(world.gravity, 'z', -10.0, 10.0, 0.1)
physicsFolder.open()

const clock = new THREE.Clock();
let delta;

const cannonDebugRenderer = new CannonDebugRenderer(scene, world)


// ANIMATE
function animate() {
    let mixerUpdateDelta = clock.getDelta();
    if (characterControls) {
        characterControls.update(mixerUpdateDelta, keysPressed);
    }
    delta = Math.min(clock.getDelta(), 0.1)
    world.step(delta)
    orbitControls.update()
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
    stats.update();
}
document.body.appendChild(renderer.domElement);
animate();

// RESIZE HANDLER
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    keyDisplayQueue.updatePosition()
}
window.addEventListener('resize', onWindowResize);

function generateFloor() {
    // TEXTURES
    // const textureLoader = new THREE.TextureLoader();
    // const placeholder = textureLoader.load("./textures/placeholder/placeholder.png");
    // const sandBaseColor = textureLoader.load("./textures/sand/Sand 002_COLOR.jpg");
    // const sandNormalMap = textureLoader.load("./textures/sand/Sand 002_NRM.jpg");
    // const sandHeightMap = textureLoader.load("./textures/sand/Sand 002_DISP.jpg");
    // const sandAmbientOcclusion = textureLoader.load("./textures/sand/Sand 002_OCC.jpg");

    // const WIDTH = 80
    // const LENGTH = 80

    // const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH, 512, 512);
    // const material = new THREE.MeshStandardMaterial(
    //     {
    //         map: sandBaseColor, normalMap: sandNormalMap,
    //         displacementMap: sandHeightMap, displacementScale: 0.1,
    //         aoMap: sandAmbientOcclusion
    //     })
    // wrapAndRepeatTexture(material.map)
    // wrapAndRepeatTexture(material.normalMap)
    // wrapAndRepeatTexture(material.displacementMap)
    // wrapAndRepeatTexture(material.aoMap)
    // // const material = new THREE.MeshPhongMaterial({ map: placeholder})

    // const floor = new THREE.Mesh(geometry, material)
    // floor.receiveShadow = true
    // floor.rotation.x = - Math.PI / 2

    new GLTFLoader().load('models/test_tunnel (1).glb', function (gltf) {
        const objectBody = new CANNON.Body({ mass: 0, material: objectMaterial });
        console.log(gltf);
        let objectShape;
        const model = gltf.scene;
        model.traverse(function (object: any) {
            if (object.isMesh) {
                object.receiveShadow = true;
                // object.material = objectMaterial;
                objectShape = ShapeFromMesh(object);
                objectBody.addShape(objectShape);
            }
        });
        world.addBody(objectBody);
        model.scale.set(1, 1, 1)
        model.position.setX(7)

        scene.add(model);
    });

}

function wrapAndRepeatTexture(map: THREE.Texture) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.repeat.x = map.repeat.y = 10
}

function light() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    const dirLight = new THREE.DirectionalLight(0xffffff, 3)
    dirLight.position.set(- 60, 100, - 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = - 50;
    dirLight.shadow.camera.left = - 50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    scene.add(dirLight);
    // scene.add( new THREE.CameraHelper(dirLight.shadow.camera))
}

function ShapeFromMesh(object: any) {

    let convexHull;
    const position = object.geometry.attributes.position.array
    const points = []
    for (let i = 0; i < position.length; i += 3) {
        points.push(
            new THREE.Vector3(position[i], position[i + 1], position[i + 2])
        )
    }
    const convexGeometry = new ConvexGeometry(points)
    convexHull = new THREE.Mesh(
        convexGeometry
    )
    return CreateConvexPolyhedron(convexHull.geometry);
}

function CreateConvexPolyhedron(geometry: any) {
    const position = geometry.attributes.position
    const normal = geometry.attributes.normal
    const vertices = []
    for (let i = 0; i < position.count; i++) {
        vertices.push(new THREE.Vector3().fromBufferAttribute(position, i))
    }
    const faces = []
    for (let i = 0; i < position.count; i += 3) {
        const vertexNormals =
            normal === undefined
                ? []
                : [
                    new THREE.Vector3().fromBufferAttribute(normal, i),
                    new THREE.Vector3().fromBufferAttribute(normal, i + 1),
                    new THREE.Vector3().fromBufferAttribute(normal, i + 2),
                ]
        const face = {
            a: i,
            b: i + 1,
            c: i + 2,
            normals: vertexNormals,
        }
        faces.push(face)
    }
    const verticesMap: any = {}
    const points: Vec3[] = []
    const changes:any[] = []
    for (let i = 0, il = vertices.length; i < il; i++) {
        const v = vertices[i]
        const key = Math.round(v.x * 100) + '_' + Math.round(v.y * 100) + '_' + Math.round(v.z * 100)
        if (verticesMap[key] === undefined) {
            verticesMap[key] = i
            points.push(new Vec3(vertices[i].x, vertices[i].y, vertices[i].z))
            changes[i] = points.length - 1
        } else {
            changes[i] = changes[verticesMap[key]]
        }
    }
    const faceIdsToRemove = []
    for (let i = 0, il = faces.length; i < il; i++) {
        const face = faces[i]
        face.a = changes[face.a]
        face.b = changes[face.b]
        face.c = changes[face.c]
        const indices = [face.a, face.b, face.c]
        for (let n = 0; n < 3; n++) {
            if (indices[n] === indices[(n + 1) % 3]) {
                faceIdsToRemove.push(i)
                break
            }
        }
    }
    for (let i = faceIdsToRemove.length - 1; i >= 0; i--) {
        const idx = faceIdsToRemove[i]
        faces.splice(idx, 1)
    }
    const cannonFaces = faces.map(function (f) {
        return [f.a, f.b, f.c]
    })
    console.log(points,cannonFaces);
    return new CANNON.ConvexPolyhedron({ vertices: points, faces: cannonFaces })
}