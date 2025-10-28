import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

// Constants
const BACKEND_URL = 'http://localhost:8000/stars/all';
const DETAIL_DISTANCE = 50;
const DETAIL_DISTANCE_SQUARED = DETAIL_DISTANCE * DETAIL_DISTANCE;
const DRAG_THRESHOLD = 5;
const LOD_UPDATE_INTERVAL = 60; // frames
const CAMERA_ANIMATION_DURATION = 1500; // ms

// Types
interface StarData {
  id: number;
  x: number;
  y: number;
  z: number;
  name?: string;
  magnitude?: number;
}

interface BackendResponse {
  positions: number[][];
  metadata: Array<{
    id: number;
    name: string;
    magnitude: number;
  }>;
  bounds: { min: number[]; max: number[] };
  count: number;
}

interface SceneSetup {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galaxyGroupRef = useRef<THREE.Group | null>(null);
  const [stars, setStars] = useState<StarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stars from backend
  useEffect(() => {
    const fetchStars = async () => {
      try {
        setLoading(true);
        const response = await fetch(BACKEND_URL);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: BackendResponse = await response.json();
        
        const transformedStars: StarData[] = data.positions.map((pos, index) => ({
          id: data.metadata[index]?.id ?? index,
          x: pos[0],
          y: pos[1],
          z: pos[2],
          name: data.metadata[index]?.name ?? `Star-${index}`,
          magnitude: data.metadata[index]?.magnitude ?? 0,
        }));
        
        setStars(transformedStars);
        console.log(`Loaded ${transformedStars.length} stars from backend`);
      } catch (err) {
        console.error('Error fetching stars:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stars');
      } finally {
        setLoading(false);
      }
    };

    fetchStars();
  }, []);

  // Three.js setup and animation
  useEffect(() => {
    if (!canvasRef.current || stars.length === 0) return;

    const { scene, camera, renderer, controls, raycaster } = setupScene(canvasRef.current);
    const galaxyGroup = createGalaxy(scene, stars, camera);
    galaxyGroupRef.current = galaxyGroup;

    // Animation loop
    let animationId: number;
    let frameCount = 0;
    
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      if (frameCount % LOD_UPDATE_INTERVAL === 0) {
        galaxyGroup.userData.updateLOD(camera);
      }
      frameCount++;
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Click detection
    const mouseDownPos = { x: 0, y: 0 };
    
    const handleMouseDown = (event: MouseEvent) => {
      mouseDownPos.x = event.clientX;
      mouseDownPos.y = event.clientY;
    };

    const handleMouseUp = (event: MouseEvent) => {
      const dx = event.clientX - mouseDownPos.x;
      const dy = event.clientY - mouseDownPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < DRAG_THRESHOLD) {
        handleStarClick(event, camera, controls, raycaster);
      }
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
    };
  }, [stars]);

  const handleStarClick = (
    event: MouseEvent,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    raycaster: THREE.Raycaster
  ) => {
    if (!galaxyGroupRef.current) return;

    const pointer = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(pointer, camera);
    raycaster.params.Points!.threshold = 1.0;
    
    const intersects = raycaster.intersectObjects(galaxyGroupRef.current.children, true);
    
    if (intersects.length > 0) {
      const starData = getStarDataFromIntersection(intersects[0]);
      
      if (starData) {
        console.log('Clicked star:', starData.name, 'ID:', starData.id);
        
        const targetPosition = new THREE.Vector3(starData.x, starData.y, starData.z)
          .add(new THREE.Vector3(10, 5, 10));
        const lookAtPosition = new THREE.Vector3(starData.x, starData.y, starData.z);
        
        animateCameraToPosition(camera, controls, targetPosition, lookAtPosition);
      }
    }
  };

  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div>Loading stars from backend...</div>
        <div style={styles.subtext}>This may take a moment...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...styles.centerContainer, color: 'red' }}>
        <div>Error loading stars:</div>
        <div>{error}</div>
        <div style={styles.subtext}>
          Make sure backend is running: uvicorn api:app --reload
        </div>
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} id="space" />
      <div style={styles.infoBox}>
        Stars loaded: {stars.length.toLocaleString()}
      </div>
    </>
  );
}

// Helper: Extract star data from raycaster intersection
function getStarDataFromIntersection(intersection: THREE.Intersection): StarData | null {
  // Check if it's a point cloud
  if (intersection.index !== undefined && intersection.object instanceof THREE.Points) {
    const allStars = intersection.object.userData.starData as StarData[];
    return allStars[intersection.index];
  }
  
  // Check if it's a detailed star
  let obj: THREE.Object3D | null = intersection.object;
  while (obj && !obj.userData.starData) {
    obj = obj.parent;
  }
  return obj?.userData.starData ?? null;
}

// Scene setup
function setupScene(canvas: HTMLCanvasElement): SceneSetup {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  
  camera.position.set(0, 20, 100);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Lighting
  const dirLight = new THREE.DirectionalLight(0x0099ff, 1);
  dirLight.position.set(0, 1, 0);
  scene.add(dirLight);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1;
  controls.maxDistance = 500;

  const raycaster = new THREE.Raycaster();

  return { scene, camera, renderer, controls, raycaster };
}

// Create detailed star mesh
function createDetailedStar(): THREE.Group {
  const group = new THREE.Group();
  
  const geometry = new THREE.SphereGeometry(0.05, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const star = new THREE.Mesh(geometry, material);
  group.add(star);
  
  const glowGeometry = new THREE.SphereGeometry(0.1, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.3
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  group.add(glow);
  
  return group;
}

// Create galaxy with LOD system
function createGalaxy(scene: THREE.Scene, starData: StarData[], camera: THREE.Camera): THREE.Group {
  const galaxyGroup = new THREE.Group();
  
  console.log('Creating galaxy with point cloud...');
  const startTime = performance.now();
  
  // Create point cloud for all stars
  const positions = new Float32Array(starData.length * 3);
  starData.forEach((star, i) => {
    positions[i * 3] = star.x;
    positions[i * 3 + 1] = star.y;
    positions[i * 3 + 2] = star.z;
  });
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8
  });
  
  const pointCloud = new THREE.Points(geometry, material);
  pointCloud.userData.starData = starData;
  pointCloud.name = 'pointCloud';
  galaxyGroup.add(pointCloud);
  
  console.log(`Created ${starData.length} stars in ${(performance.now() - startTime).toFixed(2)}ms`);
  
  // Group for detailed stars
  const detailedStarsGroup = new THREE.Group();
  detailedStarsGroup.name = 'detailedStars';
  galaxyGroup.add(detailedStarsGroup);
  
  // LOD tracking
  const detailedStarMap = new Map<number, THREE.Object3D>();
  const originalPositions = new Float32Array(positions);
  
  // LOD update function
  galaxyGroup.userData.updateLOD = (camera: THREE.Camera) => {
    const cameraPos = camera.position;
    const shouldBeDetailed = new Set<number>();
    
    // Find stars within detail distance
    starData.forEach((star, index) => {
      const dx = star.x - cameraPos.x;
      const dy = star.y - cameraPos.y;
      const dz = star.z - cameraPos.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      
      if (distanceSquared < DETAIL_DISTANCE_SQUARED) {
        shouldBeDetailed.add(index);
      }
    });
    
    // Remove far detailed stars
    detailedStarMap.forEach((starObj, index) => {
      if (!shouldBeDetailed.has(index)) {
        detailedStarsGroup.remove(starObj);
        detailedStarMap.delete(index);
        
        // Restore point
        positions[index * 3] = originalPositions[index * 3];
        positions[index * 3 + 1] = originalPositions[index * 3 + 1];
        positions[index * 3 + 2] = originalPositions[index * 3 + 2];
      }
    });
    
    // Add close detailed stars
    shouldBeDetailed.forEach(index => {
      if (!detailedStarMap.has(index)) {
        const star = starData[index];
        const detailedStar = createDetailedStar();
        detailedStar.position.set(star.x, star.y, star.z);
        detailedStar.userData.starData = star;
        
        detailedStarsGroup.add(detailedStar);
        detailedStarMap.set(index, detailedStar);
        
        // Hide point by moving far away
        positions[index * 3] = 10000;
        positions[index * 3 + 1] = 10000;
        positions[index * 3 + 2] = 10000;
      }
    });
    
    // Update geometry if needed
    if (shouldBeDetailed.size > 0 || detailedStarMap.size > shouldBeDetailed.size) {
      geometry.attributes.position.needsUpdate = true;
    }
  };
  
  // Initial LOD update
  galaxyGroup.userData.updateLOD(camera);
  
  scene.add(galaxyGroup);
  return galaxyGroup;
}

// Camera animation
function animateCameraToPosition(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  targetPosition: THREE.Vector3,
  lookAtPosition: THREE.Vector3
) {
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / CAMERA_ANIMATION_DURATION, 1);
    
    // Ease-in-out
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    camera.position.lerpVectors(startPosition, targetPosition, eased);
    controls.target.lerpVectors(startTarget, lookAtPosition, eased);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  animate();
}

// Styles
const styles = {
  centerContainer: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'white',
    fontSize: '24px',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center' as const
  },
  subtext: {
    fontSize: '14px',
    marginTop: '10px',
    color: '#888'
  },
  infoBox: {
    position: 'absolute' as const,
    top: '10px',
    left: '10px',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    background: 'rgba(0,0,0,0.7)',
    padding: '10px',
    borderRadius: '5px'
  }
};

export default App;