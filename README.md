# Journey To The Eye - Star Visualization ✨

An interactive 3D web application that visualizes over 100,000 stars from a CSV dataset. Built with React, Three.js, and Python, deployed with Vercel.

**Inspired by the game Outer Wilds** | Built for COP3530 Project 2

## See our project live here!!
https://journey-to-the-eye.vercel.app/

<img width="2851" height="1537" alt="image" src="https://github.com/user-attachments/assets/4bec7784-cceb-4660-a2d7-81ed1c2739bb" />


## 🚀 Local Development

### Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**

### Setup

1. **Make sure the backend is running** https://github.com/jkusuda/dsa-project-backend

2. **Navigate to the project directory**
   ```bash
   cd JourneyToTheEye
   ```

3. **Install JavaScript dependencies**
   ```bash
   npm install
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   The app will be available at `http://localhost:5173`

## 🎮 Usage

- **Rotate view**: Click and drag
- **Zoom**: Mouse wheel or pinch
- **Pan**: Right-click and drag
- **Select star**: Click on any star to zoom in and highlight it

## 🔧 Configuration

Edit `src/constants.ts` to adjust:

- **Performance settings**: LOD distance, update interval, max detailed stars
- **Camera settings**: FOV, near/far planes, initial position
- **Rendering settings**: Point size, star size, glow effects
- **Backend URL**: Change if running backend on different port

## 🐛 Troubleshooting

### "Error loading stars" message

- Make sure the backend server is running on port 8000
- Check that `public/stars.csv` exists

### Poor performance

- Reduce `MAX_DETAILED_STARS` in `constants.ts`
- Increase `DETAIL_DISTANCE` to show detailed stars only when closer
- Close other browser tabs/applications

## 📝 Technologies Used

- **React 19** - UI framework
- **Three.js** - 3D rendering
- **TypeScript** - Type safety
- **Vite** - Build tool
- **FastAPI** - Python backend framework
- **NumPy/SciPy** - Scientific computing and k-d trees
