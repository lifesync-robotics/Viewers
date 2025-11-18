# 🚫 Browser Security Issue: "Not Allowed to Load Local Resource"

## ❌ The Problem

```javascript
// This WILL NOT WORK in a browser:
await modelStateService.loadModel('C:\\path\\to\\model.obj', {
  viewportId: 'viewport-1',
});

// Error: Not allowed to load local resource: file:///C:/path/to/model.obj
```

## 🔒 Why This Happens

### Browser Security Restriction

Browsers **cannot** directly access local file system paths for security reasons:

1. **Same-Origin Policy**: JavaScript can only access resources from the same origin (protocol + domain + port)
2. **File Protocol Restrictions**: `file://` protocol is heavily restricted
3. **Security Risk**: Direct file access would allow malicious websites to read your files
4. **CORS**: Cross-Origin Resource Sharing doesn't apply to local files

### What Doesn't Work ❌

```javascript
// ❌ Direct file path
'C:\\Users\\hp\\Documents\\model.obj'

// ❌ file:// protocol
'file:///C:/Users/hp/Documents/model.obj'

// ❌ Local path shortcuts
'~/Documents/model.obj'
'./local/model.obj'

// ❌ Network paths (without proper server)
'\\\\server\\share\\model.obj'
```

### What DOES Work ✅

```javascript
// ✅ HTTP/HTTPS URLs
'https://example.com/models/model.obj'

// ✅ File input (user selects file)
<input type="file" onChange={handleFile} />

// ✅ Drag and drop
<div onDrop={handleDrop}>Drop files here</div>

// ✅ Blob URLs (from File API)
URL.createObjectURL(fileFromInput)
```

## ✅ Solutions

### Solution 1: File Upload (Recommended) ⭐

Use HTML5 File API to let users select files:

```typescript
import { useModelStateService } from '@ohif/extension-cornerstone';

function ModelUploader({ viewportId }) {
  const modelStateService = useModelStateService();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // This works! File API provides access to selected files
    await modelStateService.loadModelFromFileInput(file, {
      viewportId,
      color: [1, 0, 0],
    });
  };

  return (
    <input
      type="file"
      accept=".obj,.stl,.ply"
      onChange={handleFileUpload}
    />
  );
}
```

### Solution 2: Drag & Drop

```typescript
function ModelDropZone({ viewportId }) {
  const modelStateService = useModelStateService();

  const handleDrop = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (file) {
      await modelStateService.loadModelFromFileInput(file, {
        viewportId,
        color: [0, 1, 0],
      });
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        border: '2px dashed #ccc',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      Drop model files here (.obj, .stl, .ply)
    </div>
  );
}
```

### Solution 3: Load from URL

```typescript
// If models are hosted on a server
await modelStateService.loadModel(
  'https://your-server.com/models/model.obj',
  { viewportId: 'viewport-1' }
);
```

### Solution 4: Local Development Server

For development, run a local HTTP server:

```bash
# Option 1: Using Python
python -m http.server 8000

# Option 2: Using Node.js http-server
npx http-server -p 8000

# Option 3: Using Node.js serve
npx serve -p 8000

# Then access: http://localhost:8000/models/model.obj
```

## 🎨 Complete File Upload GUI Solution

I'll create a complete GUI component for you in the next files!

## 📚 More Information

- [MDN: File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [MDN: Same-Origin Policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- [HTML5 Drag and Drop](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)

---

**Next Steps:**
1. ✅ Use the File Upload GUI (see below)
2. ✅ Or set up a local development server
3. ✅ Or host models on a web server

**Don't use local file paths - they won't work in browsers!**
