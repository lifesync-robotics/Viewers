# Surgical Planning Mode

## Introduction
Surgical Planning mode allows you to:

- Draw annotations and have them shown in the measurement panel
- Track measurements over time for surgical planning
- Manage screw placements for pedicle screw surgery
- Register and align surgical navigation data
- Create reports from tracked measurements and export them as DICOM SR
- Use already exported DICOM SR to re-hydrate the measurements in the viewer

## Workflow

### Status Icon
Each viewport has a left icon indicating whether the series within the viewport contains:

- tracked measurement OR
- untracked measurement OR
- Structured Report OR
- Locked (uneditable) Structured Report

### Tracked vs Untracked Measurements

OHIF-v3 implements a workflow for measurement tracking. When you create an annotation, a prompt will be shown whether to start tracking or not. If you start the tracking, the annotation style will change to a solid line, and annotation details get displayed on the measurement panel. On the other hand, if you decline the tracking prompt, the measurement will be considered "temporary," and annotation style remains as a dashed line and not shown on the right panel, and cannot be exported.

### Screw Management

The Surgical Planner mode includes comprehensive screw management capabilities for pedicle screw surgery planning:

- Place and visualize pedicle screws in 3D
- Adjust screw parameters (length, diameter, trajectory)
- Track multiple screws per surgical plan
- Export and import screw configurations

### Reading and Writing DICOM SR

OHIF-v3 provides full support for reading, writing and mapping the DICOM Structured Report (SR) to interactable Cornerstone Tools. When you load an already exported DICOM SR into the viewer, you will be prompted whether to track the measurements for the series or not.

### Loading DICOM SR into an Already Tracked Series

If you have an already tracked series and try to load a DICOM SR measurements, you will be shown a lock icon. This means that you can review the DICOM SR measurement, manipulate image and draw "temporary" measurements; however, you cannot edit the DICOM SR measurement.

## Access

Access the Surgical Planner mode via the `/planner` route:
```
http://localhost:3000/planner?StudyInstanceUIDs=<study-id>
```
