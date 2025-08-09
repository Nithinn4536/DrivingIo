import React, { useEffect, useRef, useState } from 'react';
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

const App = () => {
    const canvasRef = useRef(null);
    const uiContainerRef = useRef(null);
    const messageBoxRef = useRef(null);
    const controlsInfoRef = useRef(null);
    
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState('sedan');
    const [selectedLocation, setSelectedLocation] = useState('city');
    const [selectedRoadType, setSelectedRoadType] = useState('straight');
    
    const gameRefs = useRef({
        scene: null,
        world: null,
        camera: null,
        renderer: null,
        clock: null,
        vehicle: null,
        controls: { forward: false, backward: false, left: false, right: false, brake: false },
        cameraViews: [],
        currentCameraViewIndex: 0,
        currentWeatherIndex: 0,
        isAutodriveOn: false,
        ambientSounds: {},
        animateId: null,
    });
    
    const showMessage = (text) => {
        if (messageBoxRef.current) {
            messageBoxRef.current.textContent = text;
            messageBoxRef.current.style.opacity = 1;
            setTimeout(() => {
                if (messageBoxRef.current) {
                    messageBoxRef.current.style.opacity = 0;
                }
            }, 2000);
        }
    };

    const createAudioForWeather = async () => {
        try {
            await Tone.start();
            gameRefs.current.ambientSounds.wind = new Tone.Noise("white").toDestination();
            gameRefs.current.ambientSounds.wind.volume.value = -20;
            gameRefs.current.ambientSounds.rain = new Tone.MetalSynth({
                frequency: 200,
                envelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.1 },
                harmonicity: 3.1, modulationIndex: 10, resonance: 400, octaves: 1.5
            }).toDestination();
            gameRefs.current.ambientSounds.rain.volume.value = -15;
            gameRefs.current.ambientSounds.engine = new Tone.Oscillator(50, "sine").toDestination();
            gameRefs.current.ambientSounds.engine.volume.value = -30;
        } catch (e) {
            console.error("Error starting audio:", e);
        }
    };
    
    const updateWeather = (weather) => {
        const { scene, ambientSounds } = gameRefs.current;
        if (!scene) return;
        showMessage(`Weather changed to ${weather}`);
        scene.children.filter(obj => obj.name === 'weather-effect').forEach(obj => scene.remove(obj));
        
        if (ambientSounds.wind) ambientSounds.wind.stop();
        if (ambientSounds.rain) ambientSounds.rain.triggerRelease();
        if (ambientSounds.engine) ambientSounds.engine.start();

        switch (weather) {
            case 'rainy':
                scene.background = new THREE.Color(0x5a5a5a);
                scene.fog = new THREE.Fog(0x5a5a5a, 50, 150);
                const rainGeometry = new THREE.BufferGeometry();
                const rainVertices = [];
                for (let i = 0; i < 5000; i++) {
                    rainVertices.push(Math.random() * 200 - 100);
                    rainVertices.push(Math.random() * 200 + 50);
                    rainVertices.push(Math.random() * 200 - 100);
                }
                rainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rainVertices, 3));
                const rainMaterial = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.5 });
                const rainParticles = new THREE.Points(rainGeometry, rainMaterial);
                rainParticles.name = 'weather-effect';
                scene.add(rainParticles);
                if (ambientSounds.wind) ambientSounds.wind.start();
                if (ambientSounds.rain) ambientSounds.rain.triggerAttackRelease("1n");
                break;
            case 'snowy':
                scene.background = new THREE.Color(0xbbddff);
                scene.fog = new THREE.Fog(0xbbddff, 50, 150);
                const snowGeometry = new THREE.BufferGeometry();
                const snowVertices = [];
                for (let i = 0; i < 5000; i++) {
                    snowVertices.push(Math.random() * 200 - 100);
                    snowVertices.push(Math.random() * 200 + 50);
                    snowVertices.push(Math.random() * 200 - 100);
                }
                snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowVertices, 3));
                const snowMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8 });
                const snowParticles = new THREE.Points(snowGeometry, snowMaterial);
                snowParticles.name = 'weather-effect';
                scene.add(snowParticles);
                if (ambientSounds.wind) ambientSounds.wind.start();
                break;
            case 'night':
                scene.background = new THREE.Color(0x000033);
                scene.fog = new THREE.Fog(0x000033, 50, 150);
                break;
            case 'autumn':
                scene.background = new THREE.Color(0xd2b48c);
                scene.fog = new THREE.Fog(0xd2b48c, 50, 150);
                break;
            case 'sunny':
            default:
                scene.background = new THREE.Color(0x87ceeb);
                scene.fog = null;
                break;
        }
    };

    const createLights = () => {
        const { scene } = gameRefs.current;
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

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
        scene.add(directionalLight);
    };

    const createVehicle = (type) => {
        const { world, scene } = gameRefs.current;
        const spec = VEHICLE_SPECS[type];

        const carBodyMesh = new THREE.Mesh(
            new THREE.BoxGeometry(spec.carBody[0], spec.carBody[1], spec.carBody[2]),
            new THREE.MeshStandardMaterial({ color: spec.color, metalness: 0.8, roughness: 0.3 })
        );
        carBodyMesh.castShadow = true;
        scene.add(carBodyMesh);

        const carBodyShape = new CANNON.Box(new CANNON.Vec3(spec.carBody[0] / 2, spec.carBody[1] / 2, spec.carBody[2] / 2));
        const chassisBody = new CANNON.Body({ mass: spec.mass });
        chassisBody.addShape(carBodyShape);
        chassisBody.position.set(0, 1, 0);
        world.addBody(chassisBody);

        const cannonVehicle = new CANNON.RaycastVehicle({ chassisBody: chassisBody });

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
            cannonVehicle.addWheel({
                ...wheelOptions,
                chassisConnectionPoint: new CANNON.Vec3(pos[0], pos[1], pos[2])
            });

            const wheelMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(spec.wheelRadius, spec.wheelRadius, 0.2, 20),
                new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.5 })
            );
            wheelMesh.rotation.x = Math.PI / 2;
            wheelMesh.castShadow = true;
            scene.add(wheelMesh);
            wheelMeshes.push(wheelMesh);
        });

        cannonVehicle.addToWorld(world);

        gameRefs.current.vehicle = {
            chassis: chassisBody,
            mesh: carBodyMesh,
            cannonVehicle: cannonVehicle,
            specs: spec,
            wheels: wheelMeshes
        };
    };

    const createRoadAndTerrain = (location, roadType) => {
        const { world, scene } = gameRefs.current;
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
        scene.add(terrainMesh);

        const groundShape = new CANNON.Box(new CANNON.Vec3(100, 0.5, roadLength));
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.position.y = -0.5;
        world.addBody(groundBody);

        let roadZ = -roadLength / 2;
        let roadX = 0;
        let roadDirection = 0;
        let roadGroup = new THREE.Group();

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
            world.addBody(roadBody);

            roadZ += 10;
            if (roadType === 'bending' || roadType === 'curves') {
                roadDirection += (Math.random() - 0.5) * 0.2;
                roadDirection = Math.max(-0.5, Math.min(0.5, roadDirection));
                roadX += roadDirection * 10;
            }
        }
        scene.add(roadGroup);
    };

    const setupCameras = () => {
        const canvas = canvasRef.current;
        const { cameraViews } = gameRefs.current;
        gameRefs.current.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        gameRefs.current.camera.position.set(0, 5, -10);
        cameraViews.push(new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000));
        cameraViews.push(new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000));
        cameraViews.push(new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000));
        gameRefs.current.currentCameraViewIndex = 0;
        gameRefs.current.camera = cameraViews[gameRefs.current.currentCameraViewIndex];
    };

    const setupControls = () => {
        const { controls } = gameRefs.current;
        const changeCamera = () => {
            const { cameraViews } = gameRefs.current;
            gameRefs.current.currentCameraViewIndex = (gameRefs.current.currentCameraViewIndex + 1) % cameraViews.length;
            gameRefs.current.camera = cameraViews[gameRefs.current.currentCameraViewIndex];
            showMessage(`Camera changed to view ${gameRefs.current.currentCameraViewIndex + 1}`);
        };

        const changeWeather = () => {
            gameRefs.current.currentWeatherIndex = (gameRefs.current.currentWeatherIndex + 1) % weatherTypes.length;
            updateWeather(weatherTypes[gameRefs.current.currentWeatherIndex]);
        };
        
        const toggleAutodrive = () => {
            gameRefs.current.isAutodriveOn = !gameRefs.current.isAutodriveOn;
            showMessage(gameRefs.current.isAutodriveOn ? "Autodrive ON" : "Autodrive OFF");
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

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    };

    const animate = () => {
        try {
            const { clock, world, renderer, scene, camera, vehicle, ambientSounds } = gameRefs.current;
            const deltaTime = clock.getDelta();
            
            if (world) {
                world.fixedStep();
            }
            
            if (vehicle) {
                const spec = vehicle.specs;
                const cannonVehicle = vehicle.cannonVehicle;
                const currentBrakingForce = spec.brakeForce * BRAKING_FORCE_MULTIPLIER[weatherTypes[gameRefs.current.currentWeatherIndex]];

                let steerValue = gameRefs.current.controls.left ? spec.maxSteer : gameRefs.current.controls.right ? -spec.maxSteer : 0;
                cannonVehicle.setSteeringValue(steerValue, 0);
                cannonVehicle.setSteeringValue(steerValue, 1);

                if (gameRefs.current.isAutodriveOn) {
                    const carForward = vehicle.chassis.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
                    const currentSpeed = vehicle.chassis.velocity.dot(carForward);
                    const targetSpeed = 20;

                    if (currentSpeed < targetSpeed) {
                        cannonVehicle.applyEngineForce(spec.motorForce, 2);
                        cannonVehicle.applyEngineForce(spec.motorForce, 3);
                    } else if (currentSpeed > targetSpeed) {
                        cannonVehicle.setBrake(spec.brakeForce, 2);
                        cannonVehicle.setBrake(spec.brakeForce, 3);
                    } else {
                        cannonVehicle.applyEngineForce(0, 2);
                        cannonVehicle.applyEngineForce(0, 3);
                    }
                    cannonVehicle.setSteeringValue(0.1, 0);
                    cannonVehicle.setSteeringValue(0.1, 1);
                } else {
                    if (gameRefs.current.controls.forward) {
                        cannonVehicle.applyEngineForce(spec.motorForce, 2);
                        cannonVehicle.applyEngineForce(spec.motorForce, 3);
                    } else if (gameRefs.current.controls.backward) {
                        cannonVehicle.applyEngineForce(-spec.motorForce, 2);
                        cannonVehicle.applyEngineForce(-spec.motorForce, 3);
                    } else {
                        cannonVehicle.applyEngineForce(0, 2);
                        cannonVehicle.applyEngineForce(0, 3);
                    }

                    if (gameRefs.current.controls.brake) {
                        cannonVehicle.setBrake(currentBrakingForce, 0);
                        cannonVehicle.setBrake(currentBrakingForce, 1);
                        cannonVehicle.setBrake(currentBrakingForce, 2);
                        cannonVehicle.setBrake(currentBrakingForce, 3);
                    } else {
                        cannonVehicle.setBrake(0, 0);
                        cannonVehicle.setBrake(0, 1);
                        cannonVehicle.setBrake(0, 2);
                        cannonVehicle.setBrake(0, 3);
                    }
                }

                for (let i = 0; i < cannonVehicle.wheelInfos.length; i++) {
                    cannonVehicle.updateWheelTransform(i);
                    const wheel = cannonVehicle.wheelInfos[i];
                    vehicle.wheels[i].position.copy(wheel.worldTransform.position);
                    vehicle.wheels[i].quaternion.copy(wheel.worldTransform.quaternion);
                }

                vehicle.mesh.position.copy(vehicle.chassis.position);
                vehicle.mesh.quaternion.copy(vehicle.chassis.quaternion);

                const carPosition = vehicle.mesh.position;
                const carRotation = vehicle.mesh.quaternion;
                const carDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(carRotation);

                const { currentCameraViewIndex } = gameRefs.current;
                if (currentCameraViewIndex === 0) {
                    const cameraOffset = new THREE.Vector3(0, 5, -10);
                    cameraOffset.applyQuaternion(carRotation);
                    camera.position.copy(carPosition).add(cameraOffset);
                    camera.lookAt(carPosition.x, carPosition.y + 1, carPosition.z);
                } else if (currentCameraViewIndex === 1) {
                    const cameraOffset = new THREE.Vector3(0, 1.5, 2);
                    cameraOffset.applyQuaternion(carRotation);
                    camera.position.copy(carPosition).add(cameraOffset);
                    const lookAtPoint = carPosition.clone().add(carDirection.multiplyScalar(10));
                    camera.lookAt(lookAtPoint.x, carPosition.y + 1.5, lookAtPoint.z);
                } else if (currentCameraViewIndex === 2) {
                    camera.position.set(carPosition.x, carPosition.y + 30, carPosition.z);
                    camera.lookAt(carPosition);
                }

                if (ambientSounds.engine) {
                    const speed = vehicle.chassis.velocity.length();
                    ambientSounds.engine.frequency.value = 50 + speed * 10;
                }
            }

            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
            
            gameRefs.current.animateId = requestAnimationFrame(animate);
        } catch (error) {
            console.error('Error in animation loop:', error);
        }
    };

    const initGame = () => {
        const canvas = canvasRef.current;
        gameRefs.current.scene = new THREE.Scene();
        gameRefs.current.world = new CANNON.World();
        gameRefs.current.world.gravity.set(0, -9.82, 0);
        gameRefs.current.world.broadphase = new CANNON.NaiveBroadphase();
        gameRefs.current.world.solver.iterations = 10;

        gameRefs.current.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
        gameRefs.current.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        gameRefs.current.renderer.shadowMap.enabled = true;
        gameRefs.current.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        gameRefs.current.clock = new THREE.Clock();
        
        createLights();
        createRoadAndTerrain(selectedLocation, selectedRoadType);
        createVehicle(selectedVehicle);
        setupCameras();
        
        createAudioForWeather();
        updateWeather(weatherTypes[gameRefs.current.currentWeatherIndex]);
        animate();
    };

    useEffect(() => {
        if (isGameStarted) {
            initGame();
        }
        
        const cleanupControls = setupControls();
        
        const onWindowResize = () => {
            const canvas = canvasRef.current;
            const { camera, renderer } = gameRefs.current;
            if (camera && renderer && canvas) {
                camera.aspect = canvas.clientWidth / canvas.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(canvas.clientWidth, canvas.clientHeight);
            }
        };
        
        window.addEventListener('resize', onWindowResize);
        
        return () => {
            window.removeEventListener('resize', onWindowResize);
            if (gameRefs.current.animateId) {
                cancelAnimationFrame(gameRefs.current.animateId);
            }
            cleanupControls();
        };
    }, [isGameStarted]);

    const handleStartGame = () => {
        if (uiContainerRef.current) {
            uiContainerRef.current.style.opacity = 0;
            uiContainerRef.current.style.pointerEvents = 'none';
        }
        if (controlsInfoRef.current) {
            controlsInfoRef.current.style.display = 'block';
        }
        setIsGameStarted(true);
    };

    return (
        <div className="relative w-full h-full">
            <div
                ref={uiContainerRef}
                className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-70 z-10 transition-opacity duration-500"
            >
                <div className="bg-gray-800 p-10 rounded-xl shadow-lg text-white text-center w-full max-w-lg">
                    <h1 className="text-3xl font-bold mb-6">Driving Simulator</h1>
                    <div className="mb-4 text-left">
                        <label htmlFor="vehicle-select" className="block text-gray-400 mb-2 font-semibold">Select Vehicle:</label>
                        <select
                            id="vehicle-select"
                            className="w-full bg-gray-700 text-white rounded-md p-2"
                            value={selectedVehicle}
                            onChange={(e) => setSelectedVehicle(e.target.value)}
                        >
                            <option value="sedan">Sedan</option>
                            <option value="suv">SUV</option>
                            <option value="hatchback">Hatchback</option>
                            <option value="truck">Truck</option>
                            <option value="bus">Bus</option>
                            <option value="bike">Bike</option>
                        </select>
                    </div>
                    <div className="mb-4 text-left">
                        <label htmlFor="location-select" className="block text-gray-400 mb-2 font-semibold">Select Location:</label>
                        <select
                            id="location-select"
                            className="w-full bg-gray-700 text-white rounded-md p-2"
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                        >
                            <option value="city">City</option>
                            <option value="hills">Hills</option>
                            <option value="forest">Forest</option>
                            <option value="desert">Desert</option>
                        </select>
                    </div>
                    <div className="mb-6 text-left">
                        <label htmlFor="road-type-select" className="block text-gray-400 mb-2 font-semibold">Select Road Type:</label>
                        <select
                            id="road-type-select"
                            className="w-full bg-gray-700 text-white rounded-md p-2"
                            value={selectedRoadType}
                            onChange={(e) => setSelectedRoadType(e.target.value)}
                        >
                            <option value="straight">Straight</option>
                            <option value="bending">Bending</option>
                            <option value="curves">Curves</option>
                        </select>
                    </div>
                    <button
                        id="start-btn"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg w-full transition duration-300"
                        onClick={handleStartGame}
                    >
                        Start Game
                    </button>
                </div>
            </div>

            <canvas ref={canvasRef} className="block w-full h-full" />
            
            <div ref={messageBoxRef} className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white py-3 px-6 rounded-lg opacity-0 transition-opacity duration-500 pointer-events-none z-20"></div>

            <div ref={controlsInfoRef} className="controls-info hidden md:block">
                <ul>
                    <li>**W/S** to accelerate/brake</li>
                    <li>**A/D** to steer left/right</li>
                    <li>**Space** for hard brake</li>
                    <li>**C** to change camera view</li>
                    <li>**E** to change weather</li>
                    <li>**F** to toggle autodrive</li>
                </ul>
            </div>
        </div>
    );
};

export default App;
