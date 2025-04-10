import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Main variables
let scene, camera, renderer, controls;
let model = null;
let directionalLight;
let isRotating = false;
let raycaster, mouse;
let loadingManager;
let progressBar, progressContainer;

// Store all meshes by index for direct manipulation
const allMeshes = [];
let lidIndex = -1;  // We'll let the user select which mesh is the lid

// Available models
const availableModels = [
    { name: "Pizza Box", path: "/model/pizza_box.glb" },
    { name: "Honey Cup", path: "model/glass_jar_with_wooden_cover.glb" },
    { name: "Cardboard Box", path: "model/set_of_cardboard_boxes.glb"},
    { name : "Pizza Box2", path: "model/PizzaBox.glb"}
    
];

// Texture loader
const textureLoader = new THREE.TextureLoader();

// Initialize the scene
function init() {
    setupLoadingManager();
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Set up camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 2, 5);

    // Set up renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // Set up raycaster for clicking on model parts
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Set up orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    setupLights();
    // addFloor();
    setupUI();
    
    // Load default model (first in the list)
    if (availableModels.length > 0) {
        loadModel(availableModels[0].path);
    }

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onMouseClick);
    animate();
}

// Setup loading manager with progress indicator
function setupLoadingManager() {
    loadingManager = new THREE.LoadingManager();
    progressContainer = document.getElementById('loading-container');
    progressBar = document.getElementById('loading-progress');
    
    loadingManager.onProgress = function(url, loaded, total) {
        if (progressBar) {
            progressBar.style.width = (loaded / total * 100) + '%';
        }
    };
    
    loadingManager.onLoad = function() {
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    };
    
    loadingManager.onStart = function() {
        if (progressContainer) {
            progressContainer.style.display = 'flex';
            progressBar.style.width = '0%';
        }
    };
    
    loadingManager.onError = function(url) {
        console.error('Error loading:', url);
        alert('Failed to load resource: ' + url);
    };
}

// Set up lights
function setupLights() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Main directional light with shadows
    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    // directionalLight.castShadow = true;
    
    // Improve shadow quality
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.bias = -0.0001;
    
    scene.add(directionalLight);
    
    // Back light for better definition
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-5, 3, -5);
    scene.add(backLight);
    
    // Add hemisphere light for better ambient lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(hemiLight);
}

// Add floor with grid
function addFloor() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xe0e0e0,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 40, 0x000000, 0x888888);
    gridHelper.position.y = -1.49;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

// Load GLTF Model
function loadModel(path) {
    // Clear existing model and meshes
    if (model) {
        scene.remove(model);
        allMeshes.length = 0;
    }
    
    const loader = new GLTFLoader(loadingManager);
    
    // Optional: Set up Draco loader for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('draco/');
    loader.setDRACOLoader(dracoLoader);
    
    loader.load(path, 
        // Success callback
        (gltf) => {
            model = gltf.scene;
            
            // Store all meshes and log them
            let meshIndex = 0;
            model.traverse(child => {
                if (child.isMesh) {
                    // Enable shadows
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // Ensure each mesh has its own material instance
                    if (child.material) {
                        child.material = child.material.clone();
                    }
                    
                    // Store each mesh in our array
                    allMeshes.push(child);
                    
                    // Log with index for debugging
                    console.log(`Mesh ${meshIndex}: ${child.name}`);
                    meshIndex++;
                }
            });

            // Center model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            
            // Move model to a good position
            model.position.y = -0.5;

            // Add to scene
            scene.add(model);
            
            // Populate mesh selector in UI
            populateMeshSelector();
            
            // Show controls once model is loaded
            document.getElementById('controls-panel').style.display = 'block';
        },
        // Progress callback
        (xhr) => {
            // Progress is handled by loading manager
        },
        // Error callback
        (error) => {
            console.error('Error loading model:', error);
            // alert('Failed to load model. Please try another one.');
        }
    );
}

// Handle mouse clicks for raycasting
function onMouseClick(event) {
    // Only handle clicks if not interacting with UI
    if (event.target.closest('#controls-panel') || event.target.closest('#top-bar')) {
        return;
    }

    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Find intersections with meshes
    const intersects = raycaster.intersectObjects(allMeshes, true);
    
    if (intersects.length > 0) {
        const selectedMesh = intersects[0].object;
        
        // Find the index of the selected mesh
        const meshIndex = allMeshes.findIndex(mesh => mesh === selectedMesh);
        
        if (meshIndex !== -1) {
            // Update mesh selector in UI
            const meshSelector = document.getElementById('mesh-selector');
            if (meshSelector) {
                meshSelector.value = meshIndex;
            }
            
            // Show context menu at click position
            showContextMenu(event.clientX, event.clientY, meshIndex);
        }
    }
}

// Show context menu for clicked mesh
function showContextMenu(x, y, meshIndex) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;
    
    // Position the menu
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = 'block';
    
    // Store selected mesh index
    contextMenu.dataset.meshIndex = meshIndex;
    
    // Update mesh name in title
    const meshName = allMeshes[meshIndex].name || `Part ${meshIndex}`;
    document.getElementById('context-menu-title').textContent = `Customize: ${meshName}`;
    
    // Close menu when clicking elsewhere
    const closeContextMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
            document.removeEventListener('click', closeContextMenu);
        }
    };
    
    // Add small delay to prevent immediate closing
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu);
    }, 100);
}

// Populate mesh selector dropdown
function populateMeshSelector() {
    const lidSelector = document.getElementById('lid-selector');
    const meshSelector = document.getElementById('mesh-selector');
    
    if (!lidSelector || !meshSelector) return;
    
    // Clear existing options
    lidSelector.innerHTML = '<option value="-1">None</option>';
    meshSelector.innerHTML = '<option value="-1">All Parts</option>';
    
    // Add an option for each mesh
    allMeshes.forEach((mesh, index) => {
        const name = mesh.name || `Part ${index}`;
        
        // Add to lid selector
        const lidOption = document.createElement('option');
        lidOption.value = index;
        lidOption.textContent = name;
        lidSelector.appendChild(lidOption);
        
        // Add to mesh selector
        const meshOption = document.createElement('option');
        meshOption.value = index;
        meshOption.textContent = name;
        meshSelector.appendChild(meshOption);
    });
    
    // Set first mesh as default lid if available
    if (allMeshes.length > 0) {
        lidSelector.value = "0";
        lidIndex = 0;
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Rotate model if enabled
    if (isRotating && model) {
        model.rotation.y += 0.01;
    }
    
    // Update controls
    controls.update();
    
    // Render scene
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Set up user interface
function setupUI() {
    // Populate model selector
    const modelSelector = document.getElementById('model-selector');
    if (modelSelector) {
        modelSelector.innerHTML = '';
        availableModels.forEach((model, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = model.name;
            modelSelector.appendChild(option);
        });
        
        modelSelector.addEventListener('change', (e) => {
            const selectedIndex = parseInt(e.target.value);
            loadModel(availableModels[selectedIndex].path);
        });
    }

    // Rotation toggle
    document.getElementById('rotate-toggle')?.addEventListener('click', () => {
        isRotating = !isRotating;
        document.getElementById('rotate-toggle').textContent = 
            isRotating ? 'Stop Rotation' : 'Start Rotation';
    });

    // Lid toggle
    document.getElementById('toggle-lid')?.addEventListener('click', () => {
        if (lidIndex >= 0 && lidIndex < allMeshes.length) {
            const lidMesh = allMeshes[lidIndex];
            const targetRotation = lidMesh.rotation.x === 0 ? Math.PI / 2 : 0;
            animateLid(lidMesh, targetRotation);
        } else {
            showToast('Please select a lid part first!');
        }
    });

    // Lid selector
    document.getElementById('lid-selector')?.addEventListener('change', (e) => {
        lidIndex = parseInt(e.target.value);
    });

    // Color picker
    document.getElementById('color-picker')?.addEventListener('input', (e) => {
        const selectedMeshIndex = parseInt(document.getElementById('mesh-selector').value);
        applyColor(e.target.value, selectedMeshIndex);
    });

    // Color picker in context menu
    document.getElementById('context-color-picker')?.addEventListener('input', (e) => {
        const contextMenu = document.getElementById('context-menu');
        const meshIndex = parseInt(contextMenu.dataset.meshIndex);
        applyColor(e.target.value, meshIndex);
    });

    // Texture selector
    document.getElementById('texture-selector')?.addEventListener('change', (e) => {
        const textureName = e.target.value;
        const selectedMeshIndex = parseInt(document.getElementById('mesh-selector').value);
        
        if (textureName === 'none') {
            applyTexture(null, selectedMeshIndex);
        } else {
            applyTexture(`textures/${textureName}.jpg`, selectedMeshIndex);
        }
    });

    // Context menu texture buttons
    document.querySelectorAll('.context-texture-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const textureName = btn.dataset.texture;
            const contextMenu = document.getElementById('context-menu');
            const meshIndex = parseInt(contextMenu.dataset.meshIndex);
            
            if (textureName === 'none') {
                applyTexture(null, meshIndex);
            } else {
                applyTexture(`textures/${textureName}.jpg`, meshIndex);
            }
            
            contextMenu.style.display = 'none';
        });
    });

    // Logo uploader
    document.getElementById('logo-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const logoUrl = event.target.result;
            const selectedMeshIndex = parseInt(document.getElementById('mesh-selector').value);
            applyTexture(logoUrl, selectedMeshIndex, true); // true = is logo
        };
        reader.readAsDataURL(file);
    });

    // Texture uploader
    document.getElementById('texture-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const textureUrl = event.target.result;
            const selectedMeshIndex = parseInt(document.getElementById('mesh-selector').value);
            applyTexture(textureUrl, selectedMeshIndex);
        };
        reader.readAsDataURL(file);
    });

    // Light intensity slider
    document.getElementById('light-intensity')?.addEventListener('input', (e) => {
        directionalLight.intensity = parseFloat(e.target.value);
    });

    // Screenshot button
    document.getElementById('screenshot-btn')?.addEventListener('click', () => {
        // Show toast notification
        showToast('Taking screenshot...');
        
        // Ensure we render before taking screenshot
        renderer.render(scene, camera);
        
        // Create download link
        const link = document.createElement('a');
        link.download = 'product-screenshot.png';
        link.href = renderer.domElement.toDataURL('image/png');
        link.click();
    });

    // Export button - add functionality for exporting configuration
    document.getElementById('export-btn')?.addEventListener('click', () => {
        exportConfiguration();
    });

    // Import button - add functionality for importing configuration
    document.getElementById('import-btn')?.addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    
    document.getElementById('import-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            importConfiguration(event.target.result);
        };
        reader.readAsText(file);
    });

    // Material property sliders
    document.getElementById('material-roughness')?.addEventListener('input', (e) => {
        const selectedMeshIndex = parseInt(document.getElementById('mesh-selector').value);
        applyMaterialProperty('roughness', parseFloat(e.target.value), selectedMeshIndex);
    });
    
    document.getElementById('material-metalness')?.addEventListener('input', (e) => {
        const selectedMeshIndex = parseInt(document.getElementById('mesh-selector').value);
        applyMaterialProperty('metalness', parseFloat(e.target.value), selectedMeshIndex);
    });

    // Reset view button
    document.getElementById('reset-view-btn')?.addEventListener('click', () => {
        camera.position.set(0, 2, 5);
        camera.lookAt(0, 0, 0);
        controls.reset();
    });

    // Color presets
    document.querySelectorAll('.color-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            document.getElementById('color-picker').value = color;
            
            const selectedMeshIndex = parseInt(document.getElementById('mesh-selector').value);
            applyColor(color, selectedMeshIndex);
        });
    });
    
    // Environment selector
    document.getElementById('environment-selector')?.addEventListener('change', (e) => {
        const environment = e.target.value;
        changeEnvironment(environment);
    });
    
    // Help button
    document.getElementById('help-btn')?.addEventListener('click', () => {
        document.getElementById('help-modal').style.display = 'flex';
    });
    
    // Close help modal
    document.getElementById('close-help')?.addEventListener('click', () => {
        document.getElementById('help-modal').style.display = 'none';
    });
}

// Show toast notification
function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, duration);
}

// Change environment background
function changeEnvironment(environment) {
    switch(environment) {
        case 'studio':
            scene.background = new THREE.Color(0xf0f0f0);
            break;
        case 'dark':
            scene.background = new THREE.Color(0x222222);
            break;
        case 'outdoor':
            // Load sky texture for outdoor environment
            textureLoader.load('textures/sky.jpg', (texture) => {
                scene.background = texture;
            });
            break;
        case 'restaurant':
            // Load restaurant interior texture
            textureLoader.load('textures/restaurant.jpg', (texture) => {
                scene.background = texture;
            });
            break;
    }
}

// Export current configuration as JSON
function exportConfiguration() {
    const config = {
        model: document.getElementById('model-selector').value,
        lidIndex: lidIndex,
        meshes: []
    };
    
    // Save individual mesh configurations
    allMeshes.forEach((mesh, index) => {
        const meshConfig = {
            index: index,
            name: mesh.name || `Part ${index}`,
            color: mesh.material.color ? '#' + mesh.material.color.getHexString() : null,
            roughness: mesh.material.roughness || 0.5,
            metalness: mesh.material.metalness || 0,
            hasTexture: mesh.material.map ? true : false
        };
        
        config.meshes.push(meshConfig);
    });
    
    // Create and download config file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "product-config.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    
    showToast('Configuration exported!');
}

// Import configuration from JSON
function importConfiguration(jsonStr) {
    try {
        const config = JSON.parse(jsonStr);
        
        // Load model first
        document.getElementById('model-selector').value = config.model;
        loadModel(availableModels[config.model].path);
        
        // Need to wait for model to load before applying configurations
        const checkModelLoaded = setInterval(() => {
            if (allMeshes.length > 0) {
                clearInterval(checkModelLoaded);
                
                // Set lid index
                lidIndex = config.lidIndex;
                document.getElementById('lid-selector').value = lidIndex;
                
                // Apply configurations to meshes
                config.meshes.forEach(meshConfig => {
                    if (meshConfig.index < allMeshes.length) {
                        if (meshConfig.color) {
                            applyColor(meshConfig.color, meshConfig.index);
                        }
                        
                        applyMaterialProperty('roughness', meshConfig.roughness, meshConfig.index);
                        applyMaterialProperty('metalness', meshConfig.metalness, meshConfig.index);
                    }
                });
                
                showToast('Configuration imported successfully!');
            }
        }, 100);
    } catch (e) {
        console.error("Error importing configuration:", e);
        showToast('Failed to import configuration!', 5000);
    }
}

// Apply material property to mesh(es)
function applyMaterialProperty(property, value, meshIndex) {
    if (!model) return;
    
    if (meshIndex === -1) {
        // Apply to all meshes
        allMeshes.forEach(mesh => {
            mesh.material[property] = value;
            mesh.material.needsUpdate = true;
        });
    } else if (meshIndex >= 0 && meshIndex < allMeshes.length) {
        // Apply to specific mesh
        const mesh = allMeshes[meshIndex];
        mesh.material[property] = value;
        mesh.material.needsUpdate = true;
    }
}

// Animate lid opening/closing
function animateLid(lidMesh, targetRotation, duration = 500) {
    const startRotation = lidMesh.rotation.x;
    const startTime = Date.now();
    
    function updateLid() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : -1 + (4 - 2 * progress) * progress;
            
        lidMesh.rotation.x = startRotation + (targetRotation - startRotation) * easeProgress;
        
        if (progress < 1) {
            requestAnimationFrame(updateLid);
        }
    }
    
    updateLid();
}

// Apply color to selected mesh(es)
function applyColor(colorHex, meshIndex) {
    if (!model) return;
    
    if (meshIndex === -1) {
        // Apply to all meshes
        allMeshes.forEach(mesh => {
            mesh.material.color.set(colorHex);
            mesh.material.needsUpdate = true;
        });
    } else if (meshIndex >= 0 && meshIndex < allMeshes.length) {
        // Apply to specific mesh
        const mesh = allMeshes[meshIndex];
        mesh.material.color.set(colorHex);
        mesh.material.needsUpdate = true;
    }
}

// Apply texture to selected mesh(es)
function applyTexture(texturePath, meshIndex, isLogo = false) {
    if (!model) return;
    
    const applyTextureToMesh = (mesh) => {
        if (!texturePath) {
            // Remove texture
            mesh.material.map = null;
            mesh.material.transparent = false;
            mesh.material.needsUpdate = true;
        } else {
            // Apply new texture
            textureLoader.load(texturePath, 
                // Success callback
                (texture) => {
                    if (isLogo) {
                        // For logos (typically with transparency)
                        mesh.material.transparent = true;
                        mesh.material.opacity = 1.0;
                    } else {
                        // For regular textures
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(1, 1);
                    }
                    
                    mesh.material.map = texture;
                    mesh.material.needsUpdate = true;
                    
                    showToast('Texture applied successfully!');
                },
                // Progress callback
                undefined,
                // Error callback
                (error) => {
                    console.error('Error loading texture:', error);
                    showToast('Error loading texture!', 5000);
                }
            );
        }
    };
    
    if (meshIndex === -1) {
        // Apply to all meshes
        allMeshes.forEach(applyTextureToMesh);
    } else if (meshIndex >= 0 && meshIndex < allMeshes.length) {
        // Apply to specific mesh
        applyTextureToMesh(allMeshes[meshIndex]);
    }
}

// Initialize everything when DOM is loaded
window.addEventListener('DOMContentLoaded', init);