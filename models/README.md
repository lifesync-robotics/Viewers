# 3D Models Directory

This directory contains 3D models for the OHIF viewer.

## Directory Structure

```
models/
├── server/          # Server-provided models (available to all users)
│   └── *.obj        # Place your default .obj models here
└── uploads/         # User-uploaded models
    └── *.obj        # User uploads are stored here
```

## Usage

### Adding Server Models

1. Place your `.obj` files in the `server/` directory
2. These models will automatically appear in the model list
3. All users will have access to these models

### User Uploads

- Users can upload their own models through the UI
- Uploaded files are stored in `uploads/` directory
- Each uploaded file gets a timestamp prefix to avoid conflicts

## Supported Formats

Currently supported:
- **OBJ** (.obj) - Wavefront Object files

## File Size Limits

- Maximum upload size: 100MB per file
- Recommended: Keep models under 50MB for better performance

## Example Models

You can download sample OBJ models from:
- [Thingiverse](https://www.thingiverse.com/)
- [Free3D](https://free3d.com/)
- [TurboSquid Free Models](https://www.turbosquid.com/Search/3D-Models/free)

## Security Notes

- Only `.obj` files are accepted
- Files are scanned for proper extensions
- CORS is properly configured to avoid browser security issues
- All file operations are logged for debugging
