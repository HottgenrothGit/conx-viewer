import { CameraProjections, IfcViewerAPI } from 'web-ifc-viewer';
import { createSideMenuButton } from './utils/gui-creator';
import {
  IFCSPACE,
  IFCOPENINGELEMENT,
  IFCFURNISHINGELEMENT,
  IFCWALL,
  IFCWINDOW,
  IFCCURTAINWALL,
  IFCMEMBER,
  IFCPLATE
} from 'web-ifc';
import {
  MeshBasicMaterial,
  LineBasicMaterial,
  Color,
  Vector2,
  DepthTexture,
  WebGLRenderTarget,
  Material,
  BufferGeometry,
  BufferAttribute,
  Mesh
} from 'three';
import { ClippingEdges } from 'web-ifc-viewer/dist/components/display/clipping-planes/clipping-edges';
import Stats from 'stats.js/src/Stats';

const container = document.getElementById('viewer-container');
const viewer = new IfcViewerAPI({ container, backgroundColor: new Color(255, 255, 255) });
viewer.axes.setAxes();
//activate 3D-grid:
//viewer.grid.setGrid();

// viewer.shadowDropper.darkness = 1.5;

// Set up stats
const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.right = '0px';
stats.dom.style.left = 'auto';
viewer.context.stats = stats;

viewer.context.ifcCamera.cameraControls;

const manager = viewer.IFC.loader.ifcManager;

async function getAllWallMeshes() {
  const wallsIDs = manager.getAllItemsOfType(0, IFCWALL, false);
  const meshes = [];
  const customID = 'temp-gltf-subset';

  for (const wallID of wallsIDs) {
    const coordinates = [];
    const expressIDs = [];
    const newIndices = [];

    const alreadySaved = new Map();

    const subset = viewer.IFC.loader.ifcManager.createSubset({
      ids: [wallID],
      modelID,
      removePrevious: true,
      customID
    });

    const positionAttr = subset.geometry.attributes.position;
    const expressIDAttr = subset.geometry.attributes.expressID;

    const newGroups = subset.geometry.groups.filter((group) => group.count !== 0);
    const newMaterials = [];
    const prevMaterials = subset.material;
    let newMaterialIndex = 0;
    newGroups.forEach((group) => {
      newMaterials.push(prevMaterials[group.materialIndex]);
      group.materialIndex = newMaterialIndex++;
    });

    let newIndex = 0;
    for (let i = 0; i < subset.geometry.index.count; i++) {
      const index = subset.geometry.index.array[i];

      if (!alreadySaved.has(index)) {
        coordinates.push(positionAttr.array[3 * index]);
        coordinates.push(positionAttr.array[3 * index + 1]);
        coordinates.push(positionAttr.array[3 * index + 2]);

        expressIDs.push(expressIDAttr.getX(index));
        alreadySaved.set(index, newIndex++);
      }

      const saved = alreadySaved.get(index);
      newIndices.push(saved);
    }

    const geometryToExport = new BufferGeometry();
    const newVerticesAttr = new BufferAttribute(Float32Array.from(coordinates), 3);
    const newExpressIDAttr = new BufferAttribute(Uint32Array.from(expressIDs), 1);

    geometryToExport.setAttribute('position', newVerticesAttr);
    geometryToExport.setAttribute('expressID', newExpressIDAttr);
    geometryToExport.setIndex(newIndices);
    geometryToExport.groups = newGroups;
    geometryToExport.computeVertexNormals();

    const mesh = new Mesh(geometryToExport, newMaterials);
    meshes.push(mesh);
  }

  viewer.IFC.loader.ifcManager.removeSubset(modelID, undefined, customID);
  return meshes;
}

// viewer.IFC.loader.ifcManager.useWebWorkers(true, 'files/IFCWorker.js');
viewer.IFC.setWasmPath('files/');

viewer.IFC.loader.ifcManager.applyWebIfcConfig({
  USE_FAST_BOOLS: true,
  COORDINATE_TO_ORIGIN: true
});

viewer.context.renderer.postProduction.active = false;

let first = true;
let model;

const selectedElementCard = document.createElement('div');
selectedElementCard.className = 'selected-element-card hidden';

const selectedElementName = document.createElement('p');
selectedElementName.className = 'selected-element-card-title';

const selectedElementCo2 = document.createElement('p');
selectedElementCo2.style.fontSize = 'bold'
selectedElementCo2.className = 'selected-element-card-status';
selectedElementCo2.innerText = 'CO2-Emissionen: Kein CO2-Wert';

const selectedElementProductPass = document.createElement('p');
selectedElementProductPass.className = 'selected-element-card-status';
selectedElementProductPass.innerText = 'Produktpass: Kein Produktpass';

selectedElementCard.append(selectedElementName, selectedElementCo2, selectedElementProductPass);

function hideSelectedElementCard() {
  selectedElementCard.classList.add('hidden');
}

function readIfcValue(value) {
  if (!value) return value;
  if (value.value !== undefined) return value.value;
  return value;
}

function normalizeName(value) {
  if (!value) return '';
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractElementName(props) {
  return (
    readIfcValue(props?.Name) ||
    readIfcValue(props?.LongName) ||
    readIfcValue(props?.type?.Name) ||
    props?.type ||
    'Unbenanntes IFC-Element'
  );
}

function readPropertySingleValue(property) {
  if (!property) return null;
  const nominal = readIfcValue(property.NominalValue);
  if (nominal !== undefined && nominal !== null && nominal !== '') return nominal;
  const direct = readIfcValue(property.Value);
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  return null;
}

function extractDigitalProductPass(props) {
  const psets = [];

  if (Array.isArray(props?.psets)) psets.push(...props.psets);
  if (Array.isArray(props?.type?.HasPropertySets)) psets.push(...props.type.HasPropertySets);
  if (Array.isArray(props?.HasPropertySets)) psets.push(...props.HasPropertySets);

  for (const pset of psets) {
    const properties = pset?.HasProperties || pset?.Properties || [];
    if (!Array.isArray(properties)) continue;

    for (const property of properties) {
      const propertyName = normalizeName(readIfcValue(property?.Name));
      if (propertyName !== 'digitalpassport' && propertyName !== 'digitalproductpass' && 
        propertyName !== 'digitalproductpassport' &&
        propertyName !== 'digitalproductpassporturl' && propertyName !== "dpp") 
        continue;

      const value = readPropertySingleValue(property);
      if (value !== null) return String(value);
    }
  }

  return null;
}

function extractCo2Emissions(props) {
  const psets = [];

  if (Array.isArray(props?.psets)) psets.push(...props.psets);
  if (Array.isArray(props?.type?.HasPropertySets)) psets.push(...props.type.HasPropertySets);
  if (Array.isArray(props?.HasPropertySets)) psets.push(...props.HasPropertySets);

  for (const pset of psets) {
    const properties = pset?.HasProperties || pset?.Properties || [];
    if (!Array.isArray(properties)) continue;

    for (const property of properties) {
      const propertyName = normalizeName(readIfcValue(property?.Name));
      if (propertyName !== 'co2emission' && propertyName !== 'co2emissions' && !propertyName.includes('co2emissions')) 
        continue;

      const value = readPropertySingleValue(property);
      if (value !== null) return String(value);
    }
  }

  return null;
}

function isStandaloneHttpsUrl(value) {
  if (!value) return false;
  const trimmed = String(value).trim();
  return /^https?:\/\/\S+$/i.test(trimmed);
}

function showSelectedElementCard(props) {
  const name = extractElementName(props);
  const digitalProductPass = extractDigitalProductPass(props);
  const co2Emissions = extractCo2Emissions(props);

  selectedElementName.innerText = name;
  selectedElementCo2.innerText = `CO2-Emissionen: ${co2Emissions || 'Kein CO2-Wert'}`;
  if (digitalProductPass && isStandaloneHttpsUrl(digitalProductPass)) {
    const linkValue = digitalProductPass.trim();
    const productPassLink = document.createElement('a');
    productPassLink.href = linkValue;
    productPassLink.target = '_blank';
    productPassLink.rel = 'noopener noreferrer';
    productPassLink.style.setProperty('color', '#5ba4e0', 'important');
    productPassLink.innerText = 'Zum Produktpass';

    selectedElementProductPass.innerText = 'Produktpass: ';
    selectedElementProductPass.append(productPassLink);
  } else {
    selectedElementProductPass.innerText = `Produktpass: ${digitalProductPass || 'Kein Produktpass'}`;
  }
  selectedElementCard.classList.remove('hidden');
}

const loadIfc = async (event) => {
  hideSelectedElementCard();
  const selectedFile = event.target.files[0];
  if (!selectedFile) return;

  const overlay = document.getElementById('loading-overlay');
  const progressText = document.getElementById('loading-progress');

  overlay.classList.remove('hidden');
  progressText.innerText = `Loading`;
  viewer.IFC.loader.ifcManager.setOnProgress((event) => {
    const percentage = Math.floor((event.loaded * 100) / event.total);
    progressText.innerText = `Loaded ${percentage}%`;
  });

  viewer.IFC.loader.ifcManager.parser.setupOptionalCategories({
    [IFCSPACE]: false,
    [IFCOPENINGELEMENT]: false
  });

  model = await viewer.IFC.loadIfc(selectedFile, false);

  // model.material.forEach(mat => mat.side = 2);

  if (first) first = false;
  else {
    ClippingEdges.forceStyleUpdate = true;
  }

  // await createFill(model.modelID);
  // viewer.edges.create(`${model.modelID}`, model.modelID, lineMaterial, baseMaterial);

  await viewer.shadowDropper.renderShadow(model.modelID);

  overlay.classList.add('hidden');
};

const inputElement = document.createElement('input');
inputElement.setAttribute('type', 'file');
inputElement.setAttribute('accept', '.ifc');
inputElement.classList.add('hidden');
inputElement.addEventListener('change', loadIfc, false);

const handleKeyDown = async (event) => {
  if (event.code === 'Delete') {
    viewer.clipper.deletePlane();
    viewer.dimensions.delete();
  }
  if (event.code === 'Escape') {
    viewer.IFC.selector.unpickIfcItems();
    viewer.IFC.selector.unHighlightIfcItems();
    hideSelectedElementCard();
  }
  if (event.code === 'KeyC') {
    viewer.context.ifcCamera.toggleProjection();
  }
  if (event.code === 'KeyD') {
    viewer.IFC.removeIfcModel(0);
    hideSelectedElementCard();
  }
};

window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
window.onkeydown = handleKeyDown;
window.ondblclick = async () => {
  if (viewer.clipper.active) {
    viewer.clipper.createPlane();
  } else {
    const result = await viewer.IFC.selector.pickIfcItem(); //before: viewer.IFC.selector.highlightIfcItem(true);
    if (!result) {
      await viewer.IFC.selector.unpickIfcItems();
      hideSelectedElementCard();
      return;
    }
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, true);
    showSelectedElementCard(props);
    console.log(props);
  }
};

//Setup UI
const linkButton = createSideMenuButton('./resources/LogoCx.png', 'Open Construct-X Website');
linkButton.addEventListener('click', () => {
  const openedWindow = window.open('https://www.construct-x.org', '_blank', 'noopener,noreferrer');
  if (openedWindow) openedWindow.opener = null;
});

linkButton.style.marginBottom = "2px";

const loadButton = createSideMenuButton('./resources/folder-icon.svg', 'Load Building Model', 'Load');
loadButton.addEventListener('click', () => {
  loadButton.blur();
  inputElement.value = '';
  inputElement.click();

  hideSelectedElementCard();
  void viewer.IFC.selector.unpickIfcItems();
  void viewer.IFC.selector.unHighlightIfcItems();
  viewer.IFC.removeAllIfcModels();
  first = true;
});

const loadAdditionalButton = createSideMenuButton('./resources/double-folder-icon.svg', 'Load Additional Model', 'Add');
loadAdditionalButton.addEventListener('click', () => {
  loadAdditionalButton.blur();
  inputElement.click();
});

container.appendChild(selectedElementCard);

const sectionButton = createSideMenuButton('./resources/section-plane-down.svg', 'Toggle Section Planes Mode', 'Sections');
sectionButton.addEventListener('click', () => {
  sectionButton.blur();
  viewer.clipper.toggle();
});
