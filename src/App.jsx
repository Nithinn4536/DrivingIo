import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';

const VEHICLE_SPECS = {
    sedan: { mass: 1500, motorForce: 500, brakeForce: 100, maxSteer: Math.PI / 8, wheelRadius: 0.35, carBody: [2.5, 1.2, 5], wheelPositions: [[-1.2, -0.6, 2], [1.2, -0.6, 2], [-1.2, -0.6, -2], [1.2, -0.6, -2]], color: 0x0000ff },
    suv: { mass: 2000, motorForce: 650, brakeForce: 120, maxSteer: Math.PI / 10, wheelRadius: 0.45, carBody: [2.8, 1.8, 5.5], wheelPositions: [[-1.3, -0.9, 2.5], [1.3, -0.9, 2.5], [-1.3, -0.9, -2.5], [1.3, -0.9, -2.5]], color: 0x556b2f },
    hatchback: { mass: 1200, motorForce: 450, brakeForce: 90, maxSteer: Math.PI / 7, wheelRadius: 0.3, carBody: [2.3, 1.1, 4], wheelPositions: [[-1.1, -0.5, 1.5], [1.1, -0.5, 1.5], [-1.1, -0.5, -1.5], [1.1, -0.5, -1.5]], color: 0xff0000 },
    truck: { mass: 5000, motorForce: 800, brakeForce: 200, maxSteer: Math.PI / 12, wheelRadius: 0.6, carBody: [3.5, 2.5, 8], wheelPositions: [[-1.5, -1.2, 3], [1.5, -1.2, 3], [-1.5, -1.2, -3], [1.5, -1.2, -3]], color: 0x8b4513 },
    bus: { mass: 6000, motorForce: 750, brakeForce: 250, maxSteer: Math.PI / 12, wheelRadius: 0.7, carBody: [3.5, 3, 12], wheelPositions: [[-1.5, -1.5, 4], [1.5, -1.5, 4], [-1.5, -1.5, -4], [1.5, -1.5, -4]], color: 0x4682b4 },
    bike: { mass: 300, motorForce: 300, brakeForce: 80, maxSteer: Math.PI / 5, wheelRadius: 0.3, carBody: [0.5, 0.8, 2], wheelPositions: [[0, -0.4, 0.8], [0, -0.4, -0.8]], color: 0xffff00 }
};

const BRAKING_FORCE_MULTIPLIER = {
    sunny: 1.0,
    rainy: 0.5,
    snowy: 0.2,
    night: 0.8,
    autumn: 0.9
};

const weatherTypes = ['sunny', 'rainy', 'snowy', 'night', 'autumn'];

const customStyles = `
    body {
        margin: 0;
        overflow: hidden;
        font-family: 'Inter', sans-serif;
        background-color: #1a202c;
    }
    #root {
        width: 100vw;
        height: 100vh;
        overflow: hidden;
    }
    canvas {
        display: block;
        width: 100vw;
        height: 100vh;
    }
    #ui-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 1000;
        transition: opacity 0.5s ease-in-out;
    }
    .ui-box {
        background-color: #2d3748;
        padding: 2.5rem;
        border-radius: 1rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        color: #e2e8f0;
        text-align: center;
    }
    .btn {
        background-image: linear-gradient(to right, #4c51bf, #667eea);
        padding: 0.75rem 2rem;
        border-radius: 0.5rem;
        font-weight: bold;
        color: white;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
    }
    .label {
        color: #cbd5e0;
        font-weight: 600;
    }
    .select {
        background-color: #4a5568;
        color: white;
        border-radius: 0.5rem;
        padding: 0.5rem;
    }
    #message-box {
        position: absolute;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
        z-index: 1001;
        pointer-events: none;
    }
    .controls-info {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        color: white;
        background-color: rgba(0, 0, 0, 0.6);
        padding: 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        line-height: 1.5;
        text-align: left;
        z-index: 100;
    }
    .controls-info ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
`;

const VEHICLE_OPTIONS = Object.keys(VEHICLE_SPECS).map(key => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1)
}));

const LOCATION_OPTIONS = [
    { value: 'city', label: 'City' },
    { value: 'hills', label: 'Hills' },
    { value: 'forest', label: 'Forest' },
    { value: 'desert', label: 'Desert' },
];

const ROAD_OPTIONS = [
    { value: 'straight', label: 'Straight' },
    { value: 'bending', label: 'Bending' },
    { value: 'curves', label: 'Curves' },
];

function App() {
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState('sedan');
    const [selectedLocation, setSelectedLocation] = useState('city');
    const [selectedRoadType, setSelectedRoadType] = useState('straight');
    const [currentWeatherIndex, setCurrentWeatherIndex] = useState(0);
    const [isAutodriveOn, setIsAutodriveOn] = useState(false);
    const [message, setMessage] = useState('');
    const [isMessageVisible, setIsMessageVisible] = useState(false);

    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const worldRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const clockRef = useRef(null);
    const vehicleRef = useRef(null);
    const controlsRef = useRef({});
    const cameraViewsRef = useRef([]);
    const currentCameraViewIndexRef = useRef(0);
    const roadCurveRef = useRef(0);
    const animateIdRef = useRef(null);
    const ambientSoundsRef = useRef({});
    
    // Display a temporary message to the user
    const showMessage = (text) => {
        setMessage(text);
        setIsMessageVisible(true);
        setTimeout(() => {
            setIsMessageVisible(false);
        }, 2000);
    };

    // Moved these functions outside of useEffect so they can be referenced
    // by other functions and event listeners correctly.
    const createAudioForWeather = useCallback(() => {
        ambientSoundsRef.current.wind = new Tone.Noise("white").toDestination();
        ambientSoundsRef.current.wind.volume.value = -20;
        ambientSoundsRef.current.rain = new Tone.MetalSynth({
            frequency: 200,
            envelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.1 },
            harmonicity: 3.1, modulationIndex: 10, resonance: 400, octaves: 1.5
        }).toDestination();
        ambientSoundsRef.current.rain.volume.value = -15;
        ambientSoundsRef.current.engine = new Tone.Oscillator(50, "sine").toDestination();
        ambientSoundsRef.current.engine.volume.value = -30;
    }, []);

    const updateWeather = useCallback((weather) => {
        if (!sceneRef.current) return;
        showMessage(`Weather changed to ${weather}`);
        sceneRef.current.children.filter(obj => obj.name === 'weather-effect').forEach(obj => sceneRef.current.remove(obj));
        
        if (ambientSoundsRef.current.wind) ambientSoundsRef.current.wind.stop();
        if (ambientSoundsRef.current.rain) ambientSoundsRef.current.rain.stop();
        if (ambientSoundsRef.current.engine) ambientSoundsRef.current.engine.start();

        let rainParticles = [];
        let snowParticles = [];

        switch(weather) {
            case 'rainy':
                sceneRef.current.background = new THREE.Color(0x5a5a5a);
                sceneRef.current.fog = new THREE.Fog(0x5a5a5a, 50, 150);
                const rainGeometry = new THREE.BufferGeometry();
                const rainVertices = [];
                for (let i = 0; i < 5000; i++) {
                    rainVertices.push(Math.random() * 200 - 100);
                    rainVertices.push(Math.random() * 200 + 50);
                    rainVertices.push(Math.random() * 200 - 100);
                }
                rainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rainVertices, 3));
                const rainMaterial = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.5 });
                rainParticles = new THREE.Points(rainGeometry, rainMaterial);
                rainParticles.name = 'weather-effect';
                sceneRef.current.add(rainParticles);
                
                if (ambientSoundsRef.current.wind) ambientSoundsRef.current.wind.start();
                if (ambientSoundsRef.current.rain) ambientSoundsRef.current.rain.triggerAttackRelease("1n");
                break;
            case 'snowy':
                sceneRef.current.background = new THREE.Color(0xbbddff);
                sceneRef.current.fog = new THREE.Fog(0xbbddff, 50, 150);
                const snowGeometry = new THREE.BufferGeometry();
                const snowVertices = [];
                for (let i = 0; i < 5000; i++) {
                    snowVertices.push(Math.random() * 200 - 100);
                    snowVertices.push(Math.random() * 200 + 50);
                    snowVertices.push(Math.random() * 200 - 100);
                }
                snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowVertices, 3));
                const snowMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8 });
                snowParticles = new THREE.Points(snowGeometry, snowMaterial);
                snowParticles.name = 'weather-effect';
                sceneRef.current.add(snowParticles);
                if (ambientSoundsRef.current.wind) ambientSoundsRef.current.wind.start();
                break;
            case 'night':
                sceneRef.current.background = new THREE.Color(0x000033);
                sceneRef.current.fog = new THREE.Fog(0x000033, 50, 150);
                break;
            case 'autumn':
                sceneRef.current.background = new THREE.Color(0xd2b48c);
                sceneRef.current.fog = new THREE.Fog(0xd2b48c, 50, 150);
                break;
            case 'sunny':
            default:
                sceneRef.current.background = new THREE.Color(0x87ceeb);
                sceneRef.current.fog = null;
                break;
        }
    }, [showMessage]);

    // This is the main game logic hook.
    useEffect(() => {
        if (!isGameStarted || !canvasRef.current) return;
        
        console.log('Game started, initializing...');

        const init = async () => {
            try {
                // Scene setup
                const newScene = new THREE.Scene();
                sceneRef.current = newScene;
                
                // Physics world setup
                const newWorld = new CANNON.World();
                newWorld.gravity.set(0, -9.82, 0);
                newWorld.broadphase = new CANNON.NaiveBroadphase();
                newWorld.solver.iterations = 10;
                worldRef.current = newWorld;
                
                // Renderer setup
                const newRenderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasRef.current });
                newRenderer.setSize(window.innerWidth, window.innerHeight);
                newRenderer.shadowMap.enabled = true;
                newRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
                rendererRef.current = newRenderer;

                // Clock for animation
                clockRef.current = new THREE.Clock();

                // Create lights
                createLights();

                // Create the road and terrain
                createRoadAndTerrain(selectedLocation, selectedRoadType);
                
                // Create the car and physics using RaycastVehicle
                createVehicle(selectedVehicle);

                // Set up cameras
                setupCameras();

                // Setup user controls
                setupControls();
                
                // Start audio context after user interaction
                try {
                    await Tone.start();
                    createAudioForWeather();
                } catch (audioError) {
                    console.error('Error starting audio:', audioError);
                }

                // Initial weather update
                updateWeather(weatherTypes[currentWeatherIndex]);

                // Start the animation loop
                animate();
                console.log('Game initialized successfully.');
            } catch (error) {
                console.error('Error during game initialization:', error);
            }
        };

        const createLights = () => {
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            sceneRef.current.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(20, 50, 10);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 100;
            directionalLight.shadow.camera.left = -50;
            directionalLight.shadow.camera.right = 50;
            directionalLight.shadow.camera.top = 50;
            directionalLight.shadow.camera.bottom = -50;
            sceneRef.current.add(directionalLight);
        };

        const createVehicle = (type) => {
            const spec = VEHICLE_SPECS[type];

            const carBodyMesh = new THREE.Mesh(
                new THREE.BoxGeometry(spec.carBody[0], spec.carBody[1], spec.carBody[2]),
                new THREE.MeshStandardMaterial({ color: spec.color, metalness: 0.8, roughness: 0.3 })
            );
            carBodyMesh.castShadow = true;
            sceneRef.current.add(carBodyMesh);

            const carBodyShape = new CANNON.Box(new CANNON.Vec3(spec.carBody[0] / 2, spec.carBody[1] / 2, spec.carBody[2] / 2));
            const chassisBody = new CANNON.Body({ mass: spec.mass });
            chassisBody.addShape(carBodyShape);
            chassisBody.position.set(0, 1, 0);
            worldRef.current.addBody(chassisBody);

            const vehicle = new CANNON.RaycastVehicle({
                chassisBody: chassisBody,
            });

            const wheelMeshes = [];
            const wheelOptions = {
                radius: spec.wheelRadius,
                suspensionStiffness: 30,
                suspensionRestLength: 0.3,
                frictionSlip: 5,
                dampingRelaxation: 2.3,
                dampingCompression: 4.4,
                maxSuspensionForce: 100000,
                rollInfluence: 0.01,
                maxSuspensionTravel: 0.3,
                customSlidingRotationalSpeed: -30,
            };

            spec.wheelPositions.forEach(pos => {
                vehicle.addWheel({
                    ...wheelOptions,
                    chassisConnectionPoint: new CANNON.Vec3(pos[0], pos[1], pos[2])
                });
                
                const wheelMesh = new THREE.Mesh(
                    new THREE.CylinderGeometry(spec.wheelRadius, spec.wheelRadius, 0.2, 20),
                    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.5 })
                );
                wheelMesh.rotation.x = Math.PI / 2;
                wheelMesh.castShadow = true;
                sceneRef.current.add(wheelMesh);
                wheelMeshes.push(wheelMesh);
            });
            
            vehicle.addToWorld(worldRef.current);

            vehicleRef.current = {
                chassis: chassisBody,
                mesh: carBodyMesh,
                cannonVehicle: vehicle,
                specs: spec,
                wheels: wheelMeshes
            };
        };
        
        const createRoadAndTerrain = (location, roadType) => {
            const roadWidth = 10;
            const roadColor = 0x555555;
            const roadLength = 500;
            const roadThickness = 0.2;

            const groundColorMap = {
                city: 0x777777,
                hills: 0x228b22,
                forest: 0x228b22,
                desert: 0xf4a460
            };
            const groundColor = groundColorMap[location];
            const terrainGeom = new THREE.BoxGeometry(200, 1, roadLength * 2);
            const terrainMat = new THREE.MeshStandardMaterial({ color: groundColor });
            const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
            terrainMesh.position.y = -0.5;
            terrainMesh.receiveShadow = true;
            sceneRef.current.add(terrainMesh);

            const groundShape = new CANNON.Box(new CANNON.Vec3(100, 0.5, roadLength));
            const groundBody = new CANNON.Body({ mass: 0 });
            groundBody.addShape(groundShape);
            groundBody.position.y = -0.5;
            worldRef.current.addBody(groundBody);

            let roadZ = -roadLength / 2;
            let roadX = 0;
            let roadDirection = 0;
            let roadPoint = 0;

            const roadGroup = new THREE.Group();

            while (roadZ < roadLength / 2) {
                const roadMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(roadWidth, roadThickness, 10),
                    new THREE.MeshStandardMaterial({ color: roadColor })
                );
                roadMesh.position.set(roadX, 0.1, roadZ);
                roadMesh.receiveShadow = true;
                roadGroup.add(roadMesh);

                const roadBody = new CANNON.Body({ mass: 0 });
                roadBody.addShape(new CANNON.Box(new CANNON.Vec3(roadWidth / 2, roadThickness / 2, 5)));
                roadBody.position.set(roadX, 0.1, roadZ);
                worldRef.current.addBody(roadBody);

                roadZ += 10;
                if (roadType === 'bending' || roadType === 'curves') {
                    roadDirection += (Math.random() - 0.5) * 0.2;
                    roadDirection = Math.max(-0.5, Math.min(0.5, roadDirection));
                    roadX += roadDirection * 10;
                }
                roadPoint++;
            }
            sceneRef.current.add(roadGroup);
        };

        const setupCameras = () => {
            const newCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            newCamera.position.set(0, 5, -10);
            cameraRef.current = newCamera;

            const thirdPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            thirdPersonCamera.position.set(0, 5, -10);
            cameraViewsRef.current.push(thirdPersonCamera);
            
            const hoodCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            hoodCamera.position.set(0, 1.5, 2);
            cameraViewsRef.current.push(hoodCamera);
            
            const topDownCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            topDownCamera.position.set(0, 30, 0);
            cameraViewsRef.current.push(topDownCamera);
            
            currentCameraViewIndexRef.current = 0;
            cameraRef.current = cameraViewsRef.current[currentCameraViewIndexRef.current];
            sceneRef.current.add(cameraRef.current);
        };
        
        const setupControls = () => {
            const controls = {
                forward: false, backward: false, left: false, right: false, brake: false
            };
            controlsRef.current = controls;

            const changeCamera = () => {
                currentCameraViewIndexRef.current = (currentCameraViewIndexRef.current + 1) % cameraViewsRef.current.length;
                cameraRef.current = cameraViewsRef.current[currentCameraViewIndexRef.current];
                showMessage(`Camera changed to view ${currentCameraViewIndexRef.current + 1}`);
            };

            const changeWeather = () => {
                const nextWeatherIndex = (currentWeatherIndex + 1) % weatherTypes.length;
                setCurrentWeatherIndex(nextWeatherIndex);
            };
            
            const toggleAutodrive = () => {
                setIsAutodriveOn(prev => !prev);
            };

            const handleKeyDown = (event) => {
                switch (event.key) {
                    case 'w': case 'W': controls.forward = true; break;
                    case 's': case 'S': controls.backward = true; break;
                    case 'a': case 'A': controls.left = true; break;
                    case 'd': case 'D': controls.right = true; break;
                    case ' ': controls.brake = true; break;
                    case 'c': case 'C': changeCamera(); break;
                    case 'e': case 'E': changeWeather(); break;
                    case 'f': case 'F': toggleAutodrive(); break;
                    default: break;
                }
            };
            const handleKeyUp = (event) => {
                switch (event.key) {
                    case 'w': case 'W': controls.forward = false; break;
                    case 's': case 'S': controls.backward = false; break;
                    case 'a': case 'A': controls.left = false; break;
                    case 'd': case 'D': controls.right = false; break;
                    case ' ': controls.brake = false; break;
                    default: break;
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('keyup', handleKeyUp);

            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('keyup', handleKeyUp);
            };
        };
        
        const updateGameLogic = () => {
            const spec = vehicleRef.current.specs;
            const vehicle = vehicleRef.current.cannonVehicle;
            
            const currentBrakingForce = spec.brakeForce * BRAKING_FORCE_MULTIPLIER[weatherTypes[currentWeatherIndex]];
            
            const steerValue = controlsRef.current.left ? spec.maxSteer : controlsRef.current.right ? -spec.maxSteer : 0;
            vehicle.setSteeringValue(steerValue, 0);
            vehicle.setSteeringValue(steerValue, 1);

            if (isAutodriveOn) {
                const carForward = vehicleRef.current.chassis.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
                const currentSpeed = vehicleRef.current.chassis.velocity.dot(carForward);
                const targetSpeed = 20;

                if (currentSpeed < targetSpeed) {
                    vehicle.applyEngineForce(spec.motorForce, 2);
                    vehicle.applyEngineForce(spec.motorForce, 3);
                } else if (currentSpeed > targetSpeed) {
                    vehicle.setBrake(spec.brakeForce, 2);
                    vehicle.setBrake(spec.brakeForce, 3);
                } else {
                    vehicle.applyEngineForce(0, 2);
                    vehicle.applyEngineForce(0, 3);
                }
                vehicle.setSteeringValue(roadCurveRef.current * 5, 0);
                vehicle.setSteeringValue(roadCurveRef.current * 5, 1);
            } else {
                if (controlsRef.current.forward) {
                    vehicle.applyEngineForce(spec.motorForce, 2);
                    vehicle.applyEngineForce(spec.motorForce, 3);
                } else if (controlsRef.current.backward) {
                    vehicle.applyEngineForce(-spec.motorForce, 2);
                    vehicle.applyEngineForce(-spec.motorForce, 3);
                } else {
                    vehicle.applyEngineForce(0, 2);
                    vehicle.applyEngineForce(0, 3);
                }
                
                if (controlsRef.current.brake) {
                    vehicle.setBrake(currentBrakingForce, 0);
                    vehicle.setBrake(currentBrakingForce, 1);
                    vehicle.setBrake(currentBrakingForce, 2);
                    vehicle.setBrake(currentBrakingForce, 3);
                } else {
                    vehicle.setBrake(0, 0);
                    vehicle.setBrake(0, 1);
                    vehicle.setBrake(0, 2);
                    vehicle.setBrake(0, 3);
                }
            }

            for (let i = 0; i < vehicle.wheelInfos.length; i++) {
                vehicle.updateWheelTransform(i);
                const wheel = vehicle.wheelInfos[i];
                vehicleRef.current.wheels[i].position.copy(wheel.worldTransform.position);
                vehicleRef.current.wheels[i].quaternion.copy(wheel.worldTransform.quaternion);
            }

            vehicleRef.current.mesh.position.copy(vehicleRef.current.chassis.position);
            vehicleRef.current.mesh.quaternion.copy(vehicleRef.current.chassis.quaternion);

            const carPosition = vehicleRef.current.mesh.position;
            const carRotation = vehicleRef.current.mesh.quaternion;
            const carDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(carRotation);

            if (currentCameraViewIndexRef.current === 0) {
                const cameraOffset = new THREE.Vector3(0, 5, -10);
                cameraOffset.applyQuaternion(carRotation);
                cameraRef.current.position.copy(carPosition).add(cameraOffset);
                cameraRef.current.lookAt(carPosition.x, carPosition.y + 1, carPosition.z);
            } else if (currentCameraViewIndexRef.current === 1) {
                const cameraOffset = new THREE.Vector3(0, 1.5, 2);
                cameraOffset.applyQuaternion(carRotation);
                cameraRef.current.position.copy(carPosition).add(cameraOffset);
                const lookAtPoint = carPosition.clone().add(carDirection.multiplyScalar(10));
                cameraRef.current.lookAt(lookAtPoint.x, carPosition.y + 1.5, lookAtPoint.z);
            } else if (currentCameraViewIndexRef.current === 2) {
                cameraRef.current.position.set(carPosition.x, carPosition.y + 30, carPosition.z);
                cameraRef.current.lookAt(carPosition);
            }

            if (ambientSoundsRef.current.engine) {
                const speed = vehicleRef.current.chassis.velocity.length();
                ambientSoundsRef.current.engine.frequency.value = 50 + speed * 10;
            }
        };

        const animate = () => {
            try {
                const deltaTime = clockRef.current.getDelta();
                if (worldRef.current) {
                    worldRef.current.fixedStep();
                    updateGameLogic();
                }
                if (rendererRef.current && sceneRef.current && cameraRef.current) {
                    rendererRef.current.render(sceneRef.current, cameraRef.current);
                }
                animateIdRef.current = requestAnimationFrame(animate);
            } catch (error) {
                console.error('Error in animation loop:', error);
            }
        };
        
        init();
        
        return () => {
            cancelAnimationFrame(animateIdRef.current);
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
            if (worldRef.current) {
                worldRef.current.bodies.forEach(body => worldRef.current.removeBody(body));
            }
        };
    }, [isGameStarted, selectedVehicle, selectedLocation, selectedRoadType, createAudioForWeather, updateWeather, currentWeatherIndex, isAutodriveOn]);

    useEffect(() => {
        const onWindowResize = () => {
            if (cameraRef.current && rendererRef.current) {
                cameraRef.current.aspect = window.innerWidth / window.innerHeight;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', onWindowResize);
        return () => window.removeEventListener('resize', onWindowResize);
    }, []);

    // Moved the weather update logic into the main useEffect to avoid a ReferenceError
    // and to ensure it only runs once at the start. The weather change event listener
    // now just updates the state, and the main useEffect handles the rendering.
    
    // Hook to handle autodrive changes
    useEffect(() => {
        if (isGameStarted) {
            showMessage(isAutodriveOn ? "Autodrive ON" : "Autodrive OFF");
        }
    }, [isAutodriveOn, isGameStarted, showMessage]);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <style>{customStyles}</style>
            {!isGameStarted ? (
                <div id="ui-container" className="flex items-center justify-center">
                    <div className="ui-box max-w-lg w-full p-10">
                        <h1 className="text-3xl font-bold mb-6">Driving Simulator</h1>
                        <div className="mb-4 text-left">
                            <label htmlFor="vehicle-select" className="label block mb-2">Select Vehicle:</label>
                            <select id="vehicle-select" className="select w-full" value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}>
                                {VEHICLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div className="mb-4 text-left">
                            <label htmlFor="location-select" className="label block mb-2">Select Location:</label>
                            <select id="location-select" className="select w-full" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
                                {LOCATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div className="mb-6 text-left">
                            <label htmlFor="road-type-select" className="label block mb-2">Select Road Type:</label>
                            <select id="road-type-select" className="select w-full" value={selectedRoadType} onChange={e => setSelectedRoadType(e.target.value)}>
                                {ROAD_OPTIONS.map(opt => <option key={opt={opt.value}} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <button className="btn w-full" onClick={() => setIsGameStarted(true)}>Start Game</button>
                    </div>
                </div>
            ) : (
                <>
                    <canvas ref={canvasRef} />
                    <div id="message-box" style={{ opacity: isMessageVisible ? 1 : 0 }}>{message}</div>
                    <div className="controls-info">
                        <ul>
                            <li>**W/S** to accelerate/brake</li>
                            <li>**A/D** to steer left/right</li>
                            <li>**Space** for hard brake</li>
                            <li>**C** to change camera view</li>
                            <li>**E** to change weather</li>
                            <li>**F** to toggle autodrive</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
export default App;
