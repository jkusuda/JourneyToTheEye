import { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { createGalaxy, getStarDataFromIntersection } from './utils/starRenderer';
import { CONFIG } from './constants';
import { useFetchStars } from './hooks/useFetchStars';
import { useDijkstra } from './hooks/useDijkstra';
import { useAStar } from './hooks/useAstar';
import { usePopupPosition } from './hooks/usePopupPosition';
import { setupScene, animateCameraToStar } from './utils/threeHelpers';
import { StarPopup } from './components/starPopup';
import { AboutPage } from './components/AboutPage';
import { DeveloperBlock } from './components/DeveloperBlock';
import { InfoBox } from './components/InfoBox';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { FuelSlider } from './components/FuelSlider';
import SoundToggle from './components/SoundToggle';

import type { StarData, LODSystem } from './types';
import './App.css';

const UI_SELECTORS = '.info-box, .star-popup, .direction-input, .fuel-slider-wrapper, .about-main, .dev-block-individual, .sound-toggle';

function App() {
  const { stars, loading, error } = useFetchStars();
  const [algorithm, setAlgorithm] = useState<'dijkstra' | 'astar' | null>(null);
  const {
    pathStarIds,
    pathSequence,
    loading: dijkstraLoading,
    pathDistance: dijkstraDistance,
    runDijkstra,
  } = useDijkstra();

  const {
    pathStarIds: aStarIds,
    pathSequence: aStarSequence,
    loading: aStarLoading,
    pathDistance: aStarDistance,
    runAStar,
  } = useAStar();

  const [selectedStar, setSelectedStar] = useState<StarData | null>(null);
  const [startingStar, setStartingStar] = useState<StarData | null>(null);
  const [destinationStar, setDestinationStar] = useState<StarData | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showAboutPage, setShowAboutPage] = useState(false);
  const [detailedCount, setDetailedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPlaceholder, setSearchPlaceholder] = useState('Search by star ID');
  const [fuelLimit, setFuelLimit] = useState(25);

  const [dijkstraTime, setDijkstraTime] = useState<number | null>(null);
  const [aStarTime, setAStarTime] = useState<number | null>(null);
  const dijkstraTimerRef = useRef<number | null>(null);
  const aStarTimerRef = useRef<number | null>(null);

  const [isDijkstraComputing, setIsDijkstraComputing] = useState(false);
  const [isAStarComputing, setIsAStarComputing] = useState(false);

  const startTimer = (algorithm: 'dijkstra' | 'astar') => {
  const startTime = performance.now();

  const updateTimer = () => {
    const elapsed = performance.now() - startTime;
    if (algorithm === 'dijkstra') setDijkstraTime(elapsed);
    else setAStarTime(elapsed);
  };

  const timer = window.setInterval(updateTimer, 10); // update every 10ms
  if (algorithm === 'dijkstra') dijkstraTimerRef.current = timer;
  else aStarTimerRef.current = timer;
};

const stopTimer = (algorithm: 'dijkstra' | 'astar') => {
  if (algorithm === 'dijkstra' && dijkstraTimerRef.current !== null) {
    clearInterval(dijkstraTimerRef.current);
    dijkstraTimerRef.current = null;
    setIsDijkstraComputing(false);
  } else if (algorithm === 'astar' && aStarTimerRef.current !== null) {
    clearInterval(aStarTimerRef.current);
    aStarTimerRef.current = null;
    setIsAStarComputing(false);
  }
};

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lodSystemRef = useRef<LODSystem | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);

  const startingStarId = startingStar?.id ?? null;
  const destinationStarId = destinationStar?.id ?? null;
  const popupPosition = usePopupPosition(selectedStar, showPopup || showAboutPage, cameraRef.current);

  // Calculate developer block positions based on the star position
  const getDeveloperBlockPositions = () => {
    if (!popupPosition || !showAboutPage) return [null, null, null];
    
    const DEV_BLOCK_WIDTH = 220;
    const DEV_BLOCK_HEIGHT = 140;
    const DEV_BLOCK_OFFSET = 180;
    const VERTICAL_SPACING = 200;
    const CONNECTION_OFFSET = 35;
    
    const starX = popupPosition.starScreenPos.x;
    const starY = popupPosition.starScreenPos.y;
    
    return [0, 1, 2].map(i => {
      const blockX = starX - DEV_BLOCK_OFFSET - DEV_BLOCK_WIDTH;
      const centerY = starY - DEV_BLOCK_HEIGHT / 2;
      const blockY = centerY + (i - 1) * VERTICAL_SPACING;
      
      return {
        x: blockX,
        y: blockY,
        starScreenPos: popupPosition.starScreenPos,
        connectionPoint: { x: blockX + DEV_BLOCK_WIDTH + CONNECTION_OFFSET, y: blockY + DEV_BLOCK_HEIGHT / 2 }
      };
    });
  };

  const [devPos1, devPos2, devPos3] = getDeveloperBlockPositions();

  const selectAndAnimateToStar = useCallback((star: StarData) => {
    console.log('Selected:', star.name, 'ID:', star.id);
    setSelectedStar(star);
    setShowPopup(false);
    setShowAboutPage(false);
    lodSystemRef.current?.selectStar(star.id);
    
    if (cameraRef.current && controlsRef.current) {
      animateCameraToStar(star, cameraRef.current, controlsRef.current, () => {
        if (star.id === -1) {
          setShowAboutPage(true);
        } else {
          setShowPopup(true);
        }
      });
    }
  }, []);

  // Event Handlers
  const handleSetStartingStar = useCallback(() => {
    if (selectedStar) {
      setStartingStar(selectedStar);
      lodSystemRef.current?.setStartingStar(selectedStar.id);
      setSelectedStar(null);
      setShowPopup(false);
      lodSystemRef.current?.selectStar(null);
    }
  }, [selectedStar]);

  const handleSetDestinationStar = useCallback(() => {
    if (selectedStar) {
      setDestinationStar(selectedStar);
      lodSystemRef.current?.setDestinationStar(selectedStar.id);
      setSelectedStar(null);
      setShowPopup(false);
      lodSystemRef.current?.selectStar(null);
    }
  }, [selectedStar]);

  const handleClosePopup = useCallback(() => {
    setSelectedStar(null);
    setShowPopup(false);
    setShowAboutPage(false);
    lodSystemRef.current?.selectStar(null);
  }, []);

  const handleCloseAboutPage = useCallback(() => {
    const star0 = stars.find(star => star.id === 0);
    if (star0) {
      selectAndAnimateToStar(star0);
    }
  }, [stars, selectAndAnimateToStar]);

  const handleRandomStar = useCallback(() => {
    if (stars.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * stars.length);
    const randomStar = stars[randomIndex];
    selectAndAnimateToStar(randomStar);
  }, [stars, selectAndAnimateToStar]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSearchPlaceholder('Search by star ID');
  }, []);

  const handleSearchSubmit = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !searchQuery.trim()) return;
    
    const starId = parseInt(searchQuery.trim());
    const foundStar = isNaN(starId) ? null : stars.find(star => star.id === starId);
    
    if (foundStar) {
      selectAndAnimateToStar(foundStar);
      setSearchQuery('');
    } else {
      setSearchPlaceholder(`No star found with ID: ${searchQuery}`);
      setSearchQuery('');
    }
  }, [searchQuery, stars, selectAndAnimateToStar]);

  const handleFindPath = useCallback((selectedAlgorithm: 'dijkstra' | 'astar') => {
    if (!startingStar || !destinationStar) return;

    console.log(`Running ${selectedAlgorithm} with fuel limit:`, fuelLimit, 'parsecs');

    if (selectedAlgorithm === 'dijkstra') {
      setIsDijkstraComputing(true);
      setDijkstraTime(0);
      startTimer('dijkstra');
      runDijkstra(startingStar.id, destinationStar.id, fuelLimit);
    } else if (selectedAlgorithm === 'astar') {
      setIsAStarComputing(true);
      setAStarTime(0);
      startTimer('astar');
      runAStar(startingStar.id, destinationStar.id, fuelLimit);
    }
  }, [startingStar, destinationStar, fuelLimit, runDijkstra, runAStar]);

  // Three.js Scene Setup (runs once when stars load)
  useEffect(() => {
    if (!canvasRef.current || stars.length === 0) return;

    const { scene, camera, renderer, controls, raycaster } = setupScene(canvasRef.current);
    cameraRef.current = camera;
    controlsRef.current = controls;
    
    const activePathIds = algorithm === 'astar' ? aStarIds : pathStarIds;
    const activePathSequence = algorithm === 'astar' ? aStarSequence : pathSequence;

    const lodSystem = createGalaxy(
      scene, 
      stars, 
      camera, 
      activePathIds,
      activePathSequence,
      startingStarId,
      destinationStarId
    );
    lodSystemRef.current = lodSystem;

    // Animation loop
    let animationId: number;
    let lastUpdate = 0;
    
    const animate = (time: number) => {
      animationId = requestAnimationFrame(animate);
      
      if (time - lastUpdate > CONFIG.LOD_UPDATE_INTERVAL) {
        lodSystem.updateLOD(camera);
        setDetailedCount(lodSystem.getDetailedStarCount());
        lastUpdate = time;
      }
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate(0);

    // Mouse interaction
    let mouseDownPos = { x: 0, y: 0 };
    
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(UI_SELECTORS)) return;
      mouseDownPos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(UI_SELECTORS)) return;
      
      const dx = e.clientX - mouseDownPos.x;
      const dy = e.clientY - mouseDownPos.y;
      const dragDist = Math.sqrt(dx * dx + dy * dy);
      
      if (dragDist < CONFIG.DRAG_THRESHOLD) {
        const pointer = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );

        raycaster.setFromCamera(pointer, camera);
        raycaster.params.Points!.threshold = CONFIG.RAYCASTER_THRESHOLD;
        
        const detailedGroup = lodSystem.group.children.find((c: any) => c.name === 'detailedStars');
        const targets = pathStarIds && detailedGroup ? [detailedGroup] : lodSystem.group.children;
        
        const hits = raycaster.intersectObjects(targets, true);
        if (hits.length > 0) {
          const star = getStarDataFromIntersection(hits[0], stars);
          if (star) {
            selectAndAnimateToStar(star);
          }
        } else {
          setSelectedStar(null);
          setShowPopup(false);
        }
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
      lodSystem.cleanup();
    };
  }, [stars, pathStarIds, pathSequence, aStarIds, aStarSequence, algorithm, selectAndAnimateToStar]);


  useEffect(() => {
    if (lodSystemRef.current && startingStarId !== null) {
      lodSystemRef.current.setStartingStar(startingStarId);
    }
  }, [startingStarId]);

  useEffect(() => {
    if (lodSystemRef.current && destinationStarId !== null) {
      lodSystemRef.current.setDestinationStar(destinationStarId);
    }
  }, [destinationStarId]);

  useEffect(() => {
    if (lodSystemRef.current && aStarIds && aStarSequence.length > 0) {
      // lodSystemRef.current.setPath(aStarSequence); // blue path
      const firstStar = stars.find(star => star.id === aStarSequence[0]);
      if (firstStar) {
        animateCameraToStar(firstStar, cameraRef.current!, controlsRef.current!);
      }
    }
  }, [aStarIds, aStarSequence, stars]);

  useEffect(() => {
    if (lodSystemRef.current && pathStarIds && pathSequence.length > 0) {
      // lodSystemRef.current.setPath(aStarSequence); // blue path
      const firstStar = stars.find(star => star.id === pathSequence[0]);
      if (firstStar) {
        animateCameraToStar(firstStar, cameraRef.current!, controlsRef.current!);
      }
    }
  }, [pathStarIds, pathSequence, stars]);

  useEffect(() => {
    if (!dijkstraLoading) stopTimer('dijkstra');
  }, [dijkstraLoading]);

  useEffect(() => {
    if (!aStarLoading) stopTimer('astar');
  }, [aStarLoading]);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;

  return (
    <>
      <canvas ref={canvasRef} id="space" />
      
      <InfoBox
        totalStars={stars.length}
        detailedCount={detailedCount}
        pathCount={pathStarIds?.size || aStarIds?.size}
        selectedStar={selectedStar}
        startingStar={startingStar}
        destinationStar={destinationStar}
        pathDistance={aStarDistance || dijkstraDistance}
        dijkstraTime={dijkstraTime}
        astarTime={aStarTime}
        isDijkstraComputing={isDijkstraComputing}
        isAstarComputing={isAStarComputing}
      />

      <div className="logo">
        <img src="/outer-wilds.png" alt="Logo" />
        <button 
          className="about-btn" 
          onClick={() => {
            const aboutStar = stars.find(star => star.id === -1);
            if (aboutStar) selectAndAnimateToStar(aboutStar);
          }}
        >
          About
        </button>
      </div>

      <FuelSlider 
        min={0}
        max={30}
        defaultValue={15}
        onChange={(value) => setFuelLimit(value)}
      />
      <SoundToggle />

      <div className="direction-input">
        <div className="algorithm-buttons">
          <button
            className={`algorithm-btn ${algorithm === 'dijkstra' ? 'active' : ''}`}
            disabled={!startingStar || !destinationStar || dijkstraLoading || aStarLoading}
            onClick={() => {
              setAlgorithm('dijkstra');
              handleFindPath('dijkstra');
            }}
          >
            {(dijkstraLoading && algorithm === 'dijkstra') ? 'Finding Path...' : 'DIJKSTRA'}
          </button>

          <button
            className={`algorithm-btn ${algorithm === 'astar' ? 'active' : ''}`}
            disabled={!startingStar || !destinationStar || dijkstraLoading || aStarLoading}
            onClick={() => {
              setAlgorithm('astar');
              handleFindPath('astar');
            }}
          >
            {(aStarLoading && algorithm === 'astar') ? 'Finding Path...' : 'A-STAR'}
          </button>

          {(dijkstraDistance || aStarDistance) && (
            <button 
              className="algorithm-btn"
              disabled={!startingStar || !destinationStar}
              onClick={handleRefresh}
            >
              RESET
            </button>
          )}
        </div>
        <div className="search-row">
          <input 
            type="text" 
            placeholder={searchPlaceholder}
            className="location-input"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchSubmit}
          />
          <button className="random-star-btn" title="Go to random star" onClick={handleRandomStar}>
            <img src="/random-button.png" alt="Random" />
          </button>
        </div>
      </div>

      {selectedStar && showPopup && !showAboutPage && popupPosition && (
        <StarPopup
          star={selectedStar}
          position={popupPosition}
          onSetStart={handleSetStartingStar}
          onSetDestination={handleSetDestinationStar}
          onClose={handleClosePopup}
        />
      )}

      {selectedStar && showAboutPage && popupPosition && (
        <AboutPage
          position={popupPosition}
          onClose={handleCloseAboutPage}
        />
      )}

      {selectedStar && showAboutPage && devPos1 && (
        <DeveloperBlock
          position={devPos1}
          developerName="Jordan Kusuda"
          year="Sophomore"
          major="Computer Science"
          linkedinUrl="https://www.linkedin.com/in/jordankusuda/"
          imageUrl="/jordankphoto.jpg"
          onClose={handleClosePopup}
        />
      )}

      {selectedStar && showAboutPage && devPos2 && (
        <DeveloperBlock
          position={devPos2}
          developerName="Lucas Kilday"
          year="Sophomore"
          major="Computer Science"
          linkedinUrl="https://www.linkedin.com/in/lucas-kilday/"
          imageUrl="/lucaskphoto.jpg"
          onClose={handleClosePopup}
        />
      )}

      {selectedStar && showAboutPage && devPos3 && (
        <DeveloperBlock
          position={devPos3}
          developerName="Carlos D Jusino"
          year="Sophomore"
          major="Computer Science & Statistics"
          linkedinUrl="https://www.linkedin.com/in/carlosdjusino/"
          imageUrl="/carlosjphoto.jpg"
          onClose={handleClosePopup}
        />
      )}
    </>
  );
}

export default App;
