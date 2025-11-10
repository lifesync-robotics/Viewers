/**
 * Example Usage of Model Server API
 *
 * This file demonstrates how to use the model server
 * functionality in your OHIF extensions or components.
 */

// ============================================================================
// Example 1: Simple Model Picker Component
// ============================================================================

/**
 * Basic React component to list and load models
 */
function ModelPicker({ servicesManager }) {
  const [models, setModels] = React.useState([]);
  const modelStateService = servicesManager.services.modelStateService;

  // Load models on mount
  React.useEffect(() => {
    async function loadModels() {
      const availableModels = await modelStateService.fetchAvailableModels();
      setModels(availableModels);
    }
    loadModels();
  }, []);

  // Handle model selection
  const handleLoadModel = async (modelUrl) => {
    await modelStateService.loadModelFromServer(modelUrl, {
      viewportId: 'viewport-3d',
      color: [1, 0.5, 0.5],
      opacity: 0.8
    });
  };

  return (
    <div className="model-picker">
      <h3>Available Models</h3>
      {models.map(model => (
        <div key={model.id} className="model-item">
          <button onClick={() => handleLoadModel(model.url)}>
            Load {model.name}
          </button>
          <span className="badge">{model.type}</span>
          <span className="size">{(model.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Example 2: Upload Model with Progress
// ============================================================================

/**
 * Component with file upload and progress indicator
 */
function ModelUploader({ servicesManager }) {
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const modelStateService = servicesManager.services.modelStateService;

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.name.endsWith('.obj')) {
      alert('Only .obj files are supported');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('File too large (max 100MB)');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Upload and load model
      const loadedModel = await modelStateService.uploadAndLoadModel(file, {
        viewportId: 'viewport-3d',
        color: [0.5, 0.5, 1],
        opacity: 1.0
      });

      if (loadedModel) {
        console.log('✅ Model loaded successfully:', loadedModel);
        alert('Model uploaded and loaded!');
      } else {
        alert('Failed to load model');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="model-uploader">
      <h3>Upload 3D Model</h3>
      <input
        type="file"
        accept=".obj"
        onChange={handleUpload}
        disabled={uploading}
      />
      {uploading && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress}%` }}>
            Uploading...
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 3: Model Manager with Server and Local Files
// ============================================================================

/**
 * Advanced component that handles both server models and local files
 */
class ModelManager extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      serverModels: [],
      userModels: [],
      loading: true
    };
    this.modelStateService = props.servicesManager.services.modelStateService;
  }

  async componentDidMount() {
    await this.refreshModels();
  }

  async refreshModels() {
    this.setState({ loading: true });

    const allModels = await this.modelStateService.fetchAvailableModels();

    this.setState({
      serverModels: allModels.filter(m => m.type === 'server'),
      userModels: allModels.filter(m => m.type === 'user'),
      loading: false
    });
  }

  async loadModel(modelUrl, color = [1, 1, 1]) {
    await this.modelStateService.loadModelFromServer(modelUrl, {
      viewportId: 'viewport-3d',
      color: color,
      opacity: 0.8
    });
  }

  async uploadModel(file) {
    const result = await this.modelStateService.uploadModelToServer(file);

    if (result.success) {
      console.log('Uploaded:', result.model.url);
      await this.refreshModels(); // Refresh list
      return result.model;
    } else {
      throw new Error(result.error);
    }
  }

  render() {
    const { serverModels, userModels, loading } = this.state;

    if (loading) {
      return <div>Loading models...</div>;
    }

    return (
      <div className="model-manager">
        <section>
          <h3>Server Models ({serverModels.length})</h3>
          {serverModels.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              onLoad={() => this.loadModel(model.url, [1, 0.5, 0.5])}
            />
          ))}
        </section>

        <section>
          <h3>My Uploaded Models ({userModels.length})</h3>
          {userModels.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              onLoad={() => this.loadModel(model.url, [0.5, 0.5, 1])}
              canDelete={true}
            />
          ))}
        </section>

        <section>
          <h3>Upload New Model</h3>
          <input
            type="file"
            accept=".obj"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) this.uploadModel(file);
            }}
          />
        </section>
      </div>
    );
  }
}

// ============================================================================
// Example 4: Toolbar Button Integration
// ============================================================================

/**
 * Example of how to add a model loader button to OHIF toolbar
 */
function createModelLoaderButton(servicesManager) {
  return {
    id: 'ModelLoader',
    type: 'ohif.radioGroup',
    props: {
      type: 'tool',
      icon: 'tool-3d-model',
      label: '3D Models',
      commands: [
        {
          commandName: 'showModelPicker',
          commandOptions: {},
        },
      ],
    },
  };
}

/**
 * Command to show model picker dialog
 */
function showModelPickerCommand({ servicesManager, commandsManager }) {
  const modelStateService = servicesManager.services.modelStateService;
  const { uiModalService } = servicesManager.services;

  // Show modal with model picker
  uiModalService.show({
    content: ModelPicker,
    title: 'Select 3D Model',
    contentProps: {
      servicesManager,
    },
  });
}

// ============================================================================
// Example 5: Direct API Usage (Without UI)
// ============================================================================

/**
 * Programmatic model loading examples
 */
async function exampleDirectUsage(modelStateService) {
  // 1. Get all available models
  console.log('Fetching models...');
  const models = await modelStateService.fetchAvailableModels();
  console.log(`Found ${models.length} models`);

  // 2. Load first server model
  if (models.length > 0) {
    const firstModel = models[0];
    console.log(`Loading ${firstModel.name}...`);

    await modelStateService.loadModelFromServer(firstModel.url, {
      viewportId: 'viewport-3d',
      color: [1, 0, 0],
      opacity: 0.9
    });

    console.log('Model loaded!');
  }

  // 3. Upload a model programmatically
  const response = await fetch('/path/to/local/model.obj');
  const blob = await response.blob();
  const file = new File([blob], 'model.obj', { type: 'text/plain' });

  const uploadResult = await modelStateService.uploadModelToServer(file);
  console.log('Upload result:', uploadResult);

  // 4. Load the uploaded model
  if (uploadResult.success) {
    await modelStateService.loadModelFromServer(uploadResult.model.url, {
      viewportId: 'viewport-3d'
    });
  }
}

// ============================================================================
// Example 6: Model Gallery Component
// ============================================================================

/**
 * Gallery-style model browser with thumbnails
 */
function ModelGallery({ servicesManager }) {
  const [models, setModels] = React.useState([]);
  const [selectedModel, setSelectedModel] = React.useState(null);
  const modelStateService = servicesManager.services.modelStateService;

  React.useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    const availableModels = await modelStateService.fetchAvailableModels();
    setModels(availableModels);
  };

  const handleModelClick = async (model) => {
    setSelectedModel(model);

    // Load model with color based on type
    const color = model.type === 'server'
      ? [1, 0.7, 0.7]  // Pink for server models
      : [0.7, 0.7, 1]; // Blue for user models

    await modelStateService.loadModelFromServer(model.url, {
      viewportId: 'viewport-3d',
      color: color,
      opacity: 0.85
    });
  };

  return (
    <div className="model-gallery">
      <div className="gallery-grid">
        {models.map(model => (
          <div
            key={model.id}
            className={`model-card ${selectedModel?.id === model.id ? 'selected' : ''}`}
            onClick={() => handleModelClick(model)}
          >
            <div className="model-icon">📦</div>
            <div className="model-name">{model.name}</div>
            <div className="model-info">
              <span className="badge">{model.type}</span>
              <span className="size">
                {(model.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedModel && (
        <div className="model-details">
          <h4>{selectedModel.name}</h4>
          <p>Type: {selectedModel.type}</p>
          <p>Size: {(selectedModel.size / 1024 / 1024).toFixed(2)} MB</p>
          <p>Format: {selectedModel.format.toUpperCase()}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 7: Integration with OHIF Panel
// ============================================================================

/**
 * Example of integrating model loader into OHIF panel
 */
function getPanelModule() {
  return {
    menuOptions: [
      {
        icon: 'settings',
        label: '3D Models',
        target: 'model-panel',
      },
    ],
    components: [
      {
        id: 'model-panel',
        component: ModelManager,
      },
    ],
    defaultContext: ['VIEWER'],
  };
}

// ============================================================================
// Example 8: Batch Loading Multiple Models
// ============================================================================

/**
 * Load multiple models at once
 */
async function loadMultipleModels(modelStateService, modelUrls) {
  const colors = [
    [1, 0.5, 0.5],  // Red
    [0.5, 1, 0.5],  // Green
    [0.5, 0.5, 1],  // Blue
    [1, 1, 0.5],    // Yellow
    [1, 0.5, 1],    // Magenta
  ];

  const loadPromises = modelUrls.map((url, index) => {
    return modelStateService.loadModelFromServer(url, {
      viewportId: 'viewport-3d',
      color: colors[index % colors.length],
      opacity: 0.7
    });
  });

  const results = await Promise.all(loadPromises);
  console.log(`Loaded ${results.filter(r => r !== null).length} models`);

  return results;
}

// Usage:
// await loadMultipleModels(modelStateService, [
//   '/models/server/brain.obj',
//   '/models/server/skull.obj',
//   '/models/uploads/custom.obj'
// ]);

// ============================================================================
// Example 9: Model Search/Filter
// ============================================================================

/**
 * Search and filter models by name or type
 */
function ModelSearch({ servicesManager }) {
  const [allModels, setAllModels] = React.useState([]);
  const [filteredModels, setFilteredModels] = React.useState([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const modelStateService = servicesManager.services.modelStateService;

  React.useEffect(() => {
    loadModels();
  }, []);

  React.useEffect(() => {
    filterModels();
  }, [searchTerm, typeFilter, allModels]);

  const loadModels = async () => {
    const models = await modelStateService.fetchAvailableModels();
    setAllModels(models);
    setFilteredModels(models);
  };

  const filterModels = () => {
    let filtered = allModels;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(m => m.type === typeFilter);
    }

    setFilteredModels(filtered);
  };

  return (
    <div className="model-search">
      <input
        type="text"
        placeholder="Search models..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
      >
        <option value="all">All Types</option>
        <option value="server">Server Models</option>
        <option value="user">My Uploads</option>
      </select>

      <div className="results">
        <p>{filteredModels.length} models found</p>
        {filteredModels.map(model => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Export Examples
// ============================================================================

export {
  ModelPicker,
  ModelUploader,
  ModelManager,
  ModelGallery,
  ModelSearch,
  createModelLoaderButton,
  showModelPickerCommand,
  exampleDirectUsage,
  loadMultipleModels,
  getPanelModule,
};
