# Medical Image Coordinate Systems - Complete Documentation Suite

## 📖 Overview

This documentation suite provides a comprehensive understanding of coordinate systems and viewport state management in OHIF Viewer using Cornerstone3D and VTK.js. It explains how DICOM medical images are transformed from raw data to rendered views on screen.

---

## 🎯 What You'll Learn

1. **Coordinate System Fundamentals**: DICOM LPS, IJK voxel indices, World coordinates
2. **Transformation Matrices**: How to convert between IJK → World → Camera → Screen
3. **VTK.js Camera System**: Understanding camera properties and viewing transformations
4. **Viewport State Architecture**: How viewport states capture and restore views
5. **Practical Implementation**: Code examples and API usage

---

## 📚 Document Suite

### 1. **COORDINATE_SYSTEMS_VISUAL_POSTER.txt** ⭐ START HERE
- **Purpose**: Quick visual reference poster
- **Audience**: Everyone (developers, students, new team members)
- **Length**: Single-page poster format
- **Content**: Visual diagrams, key formulas, quick reference tables
- **Use Case**: Print and hang on wall, quick lookups during coding

**What's Inside:**
- The three worlds of medical imaging (DICOM → World → Screen)
- LPS coordinate system diagram
- Complete transformation pipeline
- Viewport state structure
- Three synchronized viewports (MPR)
- Key formulas and calculations
- Common operations and debugging checklist

---

### 2. **VISUAL_TEACHING_GUIDE.md** 📖 BEST FOR LEARNING
- **Purpose**: Step-by-step illustrated tutorial
- **Audience**: New developers, students learning medical imaging
- **Length**: ~45 minutes reading time
- **Content**: Progressive chapters with visual examples
- **Use Case**: Self-study, onboarding new team members

**Chapters:**
1. The Big Picture - Three Worlds
2. Understanding DICOM Data
3. The LPS Coordinate System
4. The Camera and Screen
5. Viewport State - The Complete Recipe
6. Practical Walkthrough - Your Snapshot
7. Summary - The Flow of Data

**Features:**
- Explains concepts in plain English
- Uses metaphors and real-world analogies
- Progressive difficulty (beginner → advanced)
- Practice questions at the end
- Extensive ASCII art diagrams

---

### 3. **COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md** 🔬 TECHNICAL DEEP DIVE
- **Purpose**: Comprehensive technical reference
- **Audience**: Experienced developers, architects
- **Length**: ~1 hour reading time
- **Content**: Mathematical foundations, detailed algorithms, VTK internals
- **Use Case**: Deep understanding, implementing custom features

**Sections:**
1. Coordinate System Fundamentals
2. The Transformation Pipeline
3. Key Conversion Matrices (with mathematical proofs)
4. Viewport State Architecture
5. Visual Illustrations
6. Practical Examples
7. Key Takeaways for Developers
8. References and Further Reading
9. Glossary

**Features:**
- Mathematical formulas with derivations
- Matrix representations
- VTK.js and Cornerstone3D internals
- Code examples from actual codebase
- Links to external documentation
- Complete glossary of terms

---

### 4. **QUICK_REFERENCE_COORDINATE_SYSTEMS.md** ⚡ DAILY USE
- **Purpose**: Quick lookup reference for common tasks
- **Audience**: All developers during active coding
- **Length**: Scannable format
- **Content**: API reference, formulas, code snippets
- **Use Case**: Keep open while coding, quick problem solving

**Sections:**
- Three coordinate systems at a glance
- Transformation quick reference
- DICOM tags reference
- Camera properties reference
- Viewport state structure
- Common operations (with code)
- Debugging tips
- API quick links
- Glossary

**Features:**
- Table format for easy scanning
- Code snippets ready to copy-paste
- Common issues and solutions
- Debugging checklist
- Your snapshot data decoded

---

### 5. **viewport-snapshots-2025-10-31T05-22-44.json** 📊 YOUR DATA
- **Purpose**: Real-world example data
- **Content**: Actual viewport state snapshot with 3 viewports (axial, sagittal, coronal)
- **Use Case**: Reference example, testing, learning from real data

**What's Captured:**
- Three orthographic viewports (MPR configuration)
- Oblique slice with 60.34° rotation (axial)
- Complete camera configurations
- View references with slice indices
- View presentations (zoom, pan, rotation)
- All metadata

---

## 🚀 How to Use This Documentation

### For New Developers (First Time):
```
1. Read: VISUAL_TEACHING_GUIDE.md (45 min)
   ↓ Understand the concepts

2. Look at: COORDINATE_SYSTEMS_VISUAL_POSTER.txt (5 min)
   ↓ Visualize the big picture

3. Keep open: QUICK_REFERENCE_COORDINATE_SYSTEMS.md
   ↓ Use while coding
```

### For Experienced Developers:
```
1. Skim: COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md (30 min)
   ↓ Deep technical understanding

2. Bookmark: QUICK_REFERENCE_COORDINATE_SYSTEMS.md
   ↓ Daily reference

3. Print: COORDINATE_SYSTEMS_VISUAL_POSTER.txt
   ↓ Hang on wall for quick reference
```

### For Debugging Coordinate Issues:
```
1. Check: QUICK_REFERENCE_COORDINATE_SYSTEMS.md → "Debugging Tips"
   ↓

2. Verify: Your viewport state matches expected structure
   ↓

3. Compare: Your data with viewport-snapshots-2025-10-31T05-22-44.json
   ↓

4. Refer to: COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md → "Key Takeaways"
```

### For Implementing New Features:
```
1. Understand: COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md
   ↓ Deep dive into architecture

2. Reference: QUICK_REFERENCE_COORDINATE_SYSTEMS.md → "Common Operations"
   ↓ API usage examples

3. Test with: viewport-snapshots-2025-10-31T05-22-44.json
   ↓ Real-world data
```

---

## 🎓 Learning Path

### Level 1: Beginner (Complete in 1-2 days)
**Goal**: Understand basic concepts

- [ ] Read VISUAL_TEACHING_GUIDE.md Chapters 1-3
- [ ] Understand the three coordinate systems (IJK, World, Canvas)
- [ ] Learn basic DICOM tags (Position, Orientation, Spacing)
- [ ] Practice: Manually convert IJK [100, 200, 50] to world coordinates
- [ ] Review: COORDINATE_SYSTEMS_VISUAL_POSTER.txt Section 1-2

**Checkpoint Questions:**
1. What does LPS stand for?
2. What's the difference between IJK and World coordinates?
3. Which DICOM tag defines the origin?

---

### Level 2: Intermediate (Complete in 3-5 days)
**Goal**: Work with transformations and camera

- [ ] Read VISUAL_TEACHING_GUIDE.md Chapters 4-5
- [ ] Understand camera properties (position, focalPoint, viewUp, viewPlaneNormal)
- [ ] Practice: Compute viewRight vector from camera
- [ ] Implement: Pan operation using viewRight and viewUp
- [ ] Study: QUICK_REFERENCE_COORDINATE_SYSTEMS.md → "Common Operations"
- [ ] Review your snapshot: viewport-snapshots-2025-10-31T05-22-44.json

**Checkpoint Questions:**
1. What does parallelScale control?
2. How do you compute the viewRight vector?
3. What's the difference between rotation and viewUp?

**Mini-Project:**
Create a function that:
```javascript
function panViewport(viewport, deltaX, deltaY) {
  // 1. Get current camera
  // 2. Compute viewRight and viewUp
  // 3. Calculate new focalPoint
  // 4. Update camera
  // 5. Render
}
```

---

### Level 3: Advanced (Complete in 1-2 weeks)
**Goal**: Master viewport state and VTK internals

- [ ] Read COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md (complete)
- [ ] Understand VTK rendering pipeline
- [ ] Implement viewport state save/restore
- [ ] Study transformation matrices in depth
- [ ] Debug: Use QUICK_REFERENCE_COORDINATE_SYSTEMS.md debugging checklist
- [ ] Experiment: Modify viewport-snapshots-2025-10-31T05-22-44.json and restore

**Checkpoint Questions:**
1. What's stored in viewReference vs viewPresentation?
2. How does VTK transform from camera space to NDC?
3. Why do all three viewports share the same FrameOfReferenceUID?

**Advanced Project:**
Implement a feature that:
1. Saves current viewport states
2. Applies a custom transformation (e.g., rotate all views by 45°)
3. Restores original states

---

## 🔍 Key Concepts Summary

### The Three Coordinate Systems

| System | Purpose | Units | Example |
|--------|---------|-------|---------|
| **IJK** | Image storage | Voxel indices | [128, 256, 50] |
| **World (LPS)** | Physical space | Millimeters | [-10.5, 45.2, -800.3] |
| **Canvas** | Display | Pixels | [512, 384] |

### The Essential Transformations

```
IJK ──[M_IJK→World]──> World ──[Camera]──> Screen

Where:
• M_IJK→World = Direction · Spacing + Origin
• Camera = (position, focalPoint, viewUp, viewPlaneNormal)
```

### Viewport State Components

```
ViewportState {
  FrameOfReferenceUID  // Which coordinate system
  Camera               // Where we're looking
  ViewReference        // Which slice
  ViewPresentation     // UI adjustments (zoom, pan, rotation)
  Metadata             // Identification
}
```

---

## 🛠️ Practical Code Examples

### Get World Position from Canvas Click

```javascript
const handleCanvasClick = (event) => {
  const canvas = viewport.canvas;
  const rect = canvas.getBoundingClientRect();
  const canvasPos = [
    event.clientX - rect.left,
    event.clientY - rect.top
  ];

  const worldPos = viewport.canvasToWorld(canvasPos);
  console.log('Clicked world position:', worldPos);
};
```

### Save and Restore Viewport State

```javascript
// Save
const snapshot = viewportStateService.saveSnapshot("My Custom View");
console.log('Saved snapshot:', snapshot.name);

// Restore later
viewportStateService.restoreSnapshot("My Custom View");
```

### Pan Viewport Programmatically

```javascript
const panViewport = (viewport, deltaX, deltaY) => {
  const camera = viewport.getCamera();
  const { viewUp, viewPlaneNormal, focalPoint } = camera;

  // Compute viewRight
  const viewRight = vec3.cross(vec3.create(), viewPlaneNormal, viewUp);

  // Calculate new focal point
  const newFocalPoint = vec3.create();
  vec3.scaleAndAdd(newFocalPoint, focalPoint, viewRight, deltaX);
  vec3.scaleAndAdd(newFocalPoint, newFocalPoint, viewUp, deltaY);

  viewport.setCamera({ focalPoint: newFocalPoint });
  viewport.render();
};

// Usage: Pan 10mm right, 20mm up
panViewport(viewport, 10, 20);
```

---

## 🐛 Common Issues and Solutions

### Issue 1: Viewport State Doesn't Restore Correctly
**Symptom**: Restored view looks different from saved view

**Debug Steps:**
1. Check FrameOfReferenceUID matches
2. Verify camera properties are valid (unit vectors)
3. Ensure sliceIndex is within bounds
4. Compare saved vs current viewport metadata

**Solution**: See QUICK_REFERENCE_COORDINATE_SYSTEMS.md → "Debugging Tips"

---

### Issue 2: Coordinates Don't Match Between Viewports
**Symptom**: Same world position appears at different locations

**Debug Steps:**
1. Verify all viewports use same FrameOfReferenceUID
2. Check if volume is loaded correctly
3. Ensure transformation matrix is correct

**Solution**: All viewports must share the same world coordinate system.

---

### Issue 3: Camera Position Seems Wrong
**Symptom**: View is upside down or rotated unexpectedly

**Debug Steps:**
1. Check viewUp vector (should be unit length)
2. Verify viewPlaneNormal is perpendicular to viewUp
3. Look at camera distance from focal point

**Solution**: Normalize vectors and check orthogonality.

---

## 📊 Your Snapshot Analysis

Your snapshot (`viewport-snapshots-2025-10-31T05-22-44.json`) shows:

### Configuration
- **3 Viewports**: Axial, Sagittal, Coronal (standard MPR)
- **Coordinate System**: `1.2.826.0.1.3680043.8.498.12744...`
- **Volume**: `cornerstoneStreamingImageVolume:c8962ff8-ee12-bcc4-f3f2-83e148912a93`

### Interesting Features
1. **Oblique Axial View**: Rotated 60.34° (non-standard orientation)
2. **Different Slice Positions**:
   - Axial: slice 760/~1000 (76%)
   - Sagittal: slice 550/~1000 (55%)
   - Coronal: slice 586/~1000 (59%)
3. **Custom Pan Settings**: All viewports have non-zero pan offsets
4. **Consistent World Space**: All share same FrameOfReferenceUID

This demonstrates:
- ✅ Custom oblique reformatting capability
- ✅ Independent viewport manipulation
- ✅ Synchronized world coordinate system
- ✅ Complete state capture for restoration

---

## 🔗 External Resources

### Cornerstone3D Documentation
- [Official Docs](https://www.cornerstonejs.org/)
- [Viewport API](https://www.cornerstonejs.org/api/core/namespace/Viewport)
- [Camera Concepts](https://www.cornerstonejs.org/docs/concepts/cornerstone-core/camera)

### VTK.js Documentation
- [VTK.js Website](https://kitware.github.io/vtk-js/)
- [Camera Documentation](https://kitware.github.io/vtk-js/api/Rendering_Core_Camera.html)
- [Coordinate Systems](https://kitware.github.io/vtk-js/docs/develop_concepts_coordinates.html)

### DICOM Standard
- [NEMA DICOM](https://www.dicomstandard.org/)
- [Image Orientation](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html)

### Medical Imaging
- [LPS vs RAS](https://www.slicer.org/wiki/Coordinate_systems)
- [MPR Explained](https://radiopaedia.org/articles/multiplanar-reformation-mpr)

---

## ❓ FAQ

**Q: Do I need to read all documents?**
A: No. Start with VISUAL_TEACHING_GUIDE.md, then use QUICK_REFERENCE_COORDINATE_SYSTEMS.md for daily work.

**Q: Which document is best for understanding my snapshot data?**
A: QUICK_REFERENCE_COORDINATE_SYSTEMS.md has a section "Analyzing Your Snapshot Data" with detailed breakdown.

**Q: I need to implement a custom transformation. Where do I start?**
A: Read COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md Section 3 "Key Conversion Matrices", then refer to QUICK_REFERENCE_COORDINATE_SYSTEMS.md for API examples.

**Q: How do I debug coordinate issues?**
A: Use QUICK_REFERENCE_COORDINATE_SYSTEMS.md Section "Debugging Tips" and cross-reference with COORDINATE_SYSTEMS_VISUAL_POSTER.txt.

**Q: Can I print the visual poster?**
A: Yes! COORDINATE_SYSTEMS_VISUAL_POSTER.txt is designed for printing. Use monospace font for best results.

---

## 📝 Next Steps

1. **Choose your starting document** based on your experience level
2. **Work through the learning path** at your own pace
3. **Keep QUICK_REFERENCE handy** while coding
4. **Experiment with your snapshot data** to solidify understanding
5. **Build mini-projects** to practice concepts

---

## 🤝 Contributing

If you find errors or have suggestions:
1. Document unclear sections
2. Suggest additional examples
3. Share your use cases
4. Report bugs in code examples

---

## 📅 Document Information

**Created**: 2025-10-31
**Version**: 1.0
**Authors**: AI Assistant + User Collaboration
**Target Platform**: OHIF Viewer v3+ with Cornerstone3D
**Dependencies**: VTK.js, gl-matrix, @cornerstonejs/core

---

**Happy Coding! 🚀**

Remember: Understanding coordinate systems is fundamental to medical image visualization. Take your time, experiment with examples, and refer back to these documents as needed. They're designed to grow with you from beginner to expert.
