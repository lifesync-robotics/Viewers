from qt import *
import slicer, vtk
# import qdarkstyle
import os, warnings
from slicer.util import MRMLNodeNotFoundException
from scipy.spatial.transform import Rotation as R
import numpy as np
import requests
from requests.exceptions import HTTPError
# from requests.exceptions import Timeout
import json
from collections import OrderedDict
import random
from functools import partial
import xml.etree.ElementTree as ET
import argparse, sys



############################################## Global variables
# this is not how Qt, slicer work
# UIPATH = r"C:\Users\hp\tableTop\mvisioner\slicer\gui\modified_planning.ui"
# WINDOWICONPATH = r"C:\Users\hp\tableTop\mvisioner\slicer\gui\testing\Resources\project.png"
# amIrestoring = True
AUTOSAVE = True
# VIEWPOINT = "intersectionPoint"
OVERWRITE = True
TURN_ON_SEG = False
CUSTOMLAYOUT = False
SCREWMODELS = {}
SCREWDIRECTION = np.array([0, 1, 0])
# because the specification the manufacturers' screws is very odd.
# Only 35 mm is available across all diameters.
# In order not to break the code whenever the users adjust screw diameter, we set the default to 35
DEFAULT_SCREWBODYLENGTH = 35
DEFAULT_SCREWRADIUS = 6.5

VERTLABELS = ['C' + str(i) for i in range(1, 8)] + \
             ['T' + str(i) for i in range(1, 13)] + \
             ['L' + str(i) for i in range(1, 6)] + \
             ['S1']
VERTLABELS = tuple(VERTLABELS) # Immutable !

VERTLABELTOID = {label: i + 1 for i, label in enumerate(VERTLABELS)}
VERTIDTOLABEL = {i + 1: label for i, label in enumerate(VERTLABELS)}
SCREWNAMES = [f'L{i}{j}' for i in range(1, 6) for j in ['L', 'R']] + ['S1L', 'S1R'] + [f'T{i}{j}' for i in range(1, 13)
                                                                                       for j in ['L', 'R']] + [
                 f'C{i}{j}' for i in range(1, 8) for j in ['L', 'R']]

SCREWNAMES = tuple(SCREWNAMES)

SCREWIDS = {name: i for i, name in enumerate(SCREWNAMES)}
SCREWCOLORS = [(a, b, c) for a in [1, 0.75, 0.25, 0] for b in [1, 0.75, 0.25, 0] for c in [1, 0.75, 0.25, 0]]
SCREWCOLORS = tuple(SCREWCOLORS)

assert len(SCREWCOLORS) >= len(SCREWNAMES)
SCREWCOLORSMAP = {name: color for name, color in zip(SCREWNAMES, SCREWCOLORS)}

SCREWPROPERTY = {'radius': None,
                 'length': None}


###################
ALLOW_T13 = False
ALLOW_L6 = False
DISALLOW_T12 = False  # NotImplementedError!
if DISALLOW_T12:
    ALLOW_T13 = False

################# restore screws from xml project file


# def my_xml_parser(project_dir, project_name=None):


    # # xml_dir = os.path.join(project_dir, r"Projects")

    # # for item in os.listdir(xml_dir):

    # #     if project_name is None:
    # #         xml_dir = os.path.join(xml_dir, item)
    # #         break

    # #     if item  == project_name and project_name is not None:
    # #         xml_dir = os.path.join(xml_dir, item)
    # #         break
    # # else:
    # #     raise RuntimeError(f'project name {project_name} is NOT found!')


    # # xmlfile = os.path.join(xml_dir, 'custusdoc.xml')

    # xmlfile = os.path.join(project_dir, 'custusdoc.xml')
    # print("xmlfile ", xmlfile)
    # tree = ET.parse(xmlfile)
    # root = tree.getroot()

    # for item in root:
    #     if item.tag == 'managers':
    #         # print (item)
    #         managers = item
    #         break
    # else:
    #     print ('No managers')
class NoScrewError(Exception):

    def __init__(self, message):
        self.message = f"We cannot find any screw in the xml for project inside {message}"
        super().__init__(self.message)


class NoImageError(Exception):

    def __init__(self, message):
        self.message = f"We cannot find any DICOM in the xml for project inside {message}"
        super().__init__(self.message)


def verify_xml(root, project_dir):
    """
    like a recursive function, this function tries to find all the items inside a subtree.
    """
    score = 0  # found our screw components gives a reward of 1 score
    screws = None
    imagePath = None

    for item in root:

        if score == 1:
            break

        if item.tag == 'managers':
            print(item)
            managers = item

            for item in managers:

                if score == 1:
                    break

                if item.tag == 'datamanager':
                    print(item)
                    datamanager = item

                    for item in datamanager:

                        if score == 1:
                            break

                        if item.tag == 'data':

                            if score == 1:
                                break

                            print(item)
                            data = item

                            for item in data:

                                if score == 1:
                                    break

                                if item.tag == 'filePath':
                                    print(item)
                                    filePath = item
                                    imagePath = os.path.join(project_dir, *filePath.text.split("/"))
                                    print('imagePath ', imagePath)

                            else:
                                print('NO filePath')

                            for item in data:

                                if score == 1:
                                    break

                                if item.tag == 'screws':
                                    screws = item
                                    print(item)
                                    score = 1
                            else:
                                print('NO screws')

                    else:
                        print('NO data')


            else:
                print('NO datamanager')



    else:
        print('No managers')

    return (screws, imagePath)


def my_xml_parser(project_dir, project_name=None):
    # xml_dir = os.path.join(project_dir, r"Projects")

    # for item in os.listdir(xml_dir):

    #     if project_name is None:
    #         xml_dir = os.path.join(xml_dir, item)
    #         break

    #     if item == project_name and project_name is not None:
    #         xml_dir = os.path.join(xml_dir, item)
    #         break
    # else:
    #     raise RuntimeError(f'project name {project_name} is NOT found!')

    # xmlfile = os.path.join(xml_dir, 'custusdoc.xml')
    xmlfile = os.path.join(project_dir, 'custusdoc.xml')
    tree = ET.parse(xmlfile)
    root = tree.getroot()

    # for item in root:
    #     if item.tag == 'managers':
    #         # print (item)
    #         managers = item
    #         break
    # else:
    #     raise ValueError('No managers')
    #
    # for item in managers:
    #     if item.tag == 'datamanager':
    #         # print (item)
    #         datamanager = item
    #         break
    # else:
    #     raise ValueError('NO datamanager')
    #
    # # for item in datamanager:
    # #     if item.tag == 'screwprops':
    # #         # print (item)
    # #         screwprops = item
    # #         break
    # # else:
    # #     print ('NO screwprops')
    #
    # for item in datamanager:
    #     if item.tag == 'data':
    #         # print (item)
    #         data = item
    #         break
    # else:
    #     raise ValueError('NO data')
    #
    # for item in data:
    #     if item.tag == 'filePath':
    #         # print (item)
    #         filePath = item
    #         break
    # else:
    #     raise ValueError('NO filePath')
    #
    # imagePath = os.path.join(project_dir, *filePath.text.split("/"))
    # print('imagePath ', imagePath)
    #
    # for item in data:
    #     if item.tag == 'screws':
    #         screws = item
    #         # print (item)
    #         break
    # else:
    #     raise ValueError('NO screws')

    screws, imagePath = verify_xml(root, project_dir)
    if screws is None:
        raise NoScrewError(project_dir)
    if imagePath is None:
        raise NoImageError(project_dir)

    if screws != None and imagePath != None:

        properties = {}

        for i, screw in enumerate(screws):
            for item in screw:
                if item.tag == 'rMt':
                    matrix = item
                    # print (item)

                    properties[screw.attrib['name']] = {'rMt': string_to_float(matrix),
                                                        'length': screw.attrib['length'],
                                                        'radius': screw.attrib['radius']}

    return properties, imagePath

def string_to_float(matrix):
    ii = [0] # initial start point
    for i, c in enumerate(matrix.text):
        if c == ' ' or c == '\n':
            ii.append(i)
    # end of string
    ii.append(i + 1)

    # print (ii)
    gaps = [b - a for a, b in zip(ii[0:-1], ii[1:])]

    j = []
    j2 = []
    for k, g in enumerate(gaps):
        if g > 1:
            j.append(ii[k])
            j2.append(ii[k + 1])
    # print (j)
    # print (j2)

    array = []
    for a, b in zip(j, j2):
        # print (a, b, matrix.text[a:b])
        array.append(float(matrix.text[a:b]))

    if len(array) != 4 * 4:
        print(f"matrix.text = {matrix.text}")
        print(f"ii = {ii}")
        print(f"gaps {gaps}")
        print(f"j = {j}")
        print(f"j2 = {j2}")

        raise RuntimeError('array is likely wrong {}'.format(array))
    return array


def create_frame_matrices():

    ijkToRas = vtk.vtkMatrix4x4()
    t = slicer.util.getNodesByClass('vtkMRMLScalarVolumeNode')[0]
    t.GetIJKToRASMatrix(ijkToRas)
    ijkToRas = slicer.util.arrayFromVTKMatrix(ijkToRas)
    print (ijkToRas)

    ijkToLPI = np.copy(ijkToRas)

    ijkToLPI[0,0] *= -1.0
    ijkToLPI[1,1] *= -1.0
    ijkToLPI[0,3] *= -1.0
    ijkToLPI[1,3] *= -1.0

    # print (ijkToLPI)

    LPIToijk = np.linalg.inv(ijkToLPI)

    return {'ijkToRas': ijkToRas,
            'LPIToijk': LPIToijk}

def points_in_RAS(rMt, LPIToijk, ijkToRas):

    # rMt = np.array([0.982278, 0.187429, 6.93889e-18, 33.7793, -0.184603, 0.967468, -0.172993, -7.97225, -0.0324239, 0.169927, 0.984923, 10.5928, 0.0, 0.0, 0.0, 1.0]).reshape(4,4)
    rMt = np.array(rMt).reshape(4,4)
    print (rMt)


    p1 = np.array([0,0,0,1])
    p2 = np.array([0,-DEFAULT_SCREWBODYLENGTH,0,1])

    p1 = np.matmul(rMt, p1)
    print (p1)

    p2 = np.matmul(rMt, p2)
    print (p2)

    p1_ijk = np.matmul(LPIToijk, p1)
    p2_ijk = np.matmul(LPIToijk, p2)

    # ijkToRas = np.array([[ -0.313  ,    0.       ,  0.       , 79.9715  ],
    # [  0.     ,    0.313    ,  0.       ,-79.9715  ],
    # [  0.     ,    0.       , -0.312389 , 79.9715  ],
    # [  0.     ,    0.       ,  0.       ,  1.      ]])

    p1 = np.matmul(ijkToRas, p1_ijk)[0:3]
    p2 = np.matmul(ijkToRas, p2_ijk)[0:3]

    return p1, p2




def build_pointLists(properties, frame_matrices):

    # DEBUG: Only restore first 2 screws for debugging
    screw_count = 0
    for name, value in properties.items():

        print ('creating a point list for ', name)

        pointListNode = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLMarkupsFiducialNode")
        pointListNode.SetName(name)

        p1, p2 = points_in_RAS(value['rMt'], frame_matrices['LPIToijk'], frame_matrices['ijkToRas'])
        pointListNode.AddControlPoint(p1)
        pointListNode.AddControlPoint(p2)

        # # DEBUG: Break after first 2 screws
        # screw_count += 1
        # if screw_count >= 10:
        #     print(f'DEBUG: Only restored first {screw_count} screws for debugging')
        #     break

def handle_user_dir(user_dir):

    if user_dir != ' ':
        if os.path.isdir(user_dir):
            project_dir = user_dir
        else:
            raise ValueError('NOT a directory')

    print ('reading from {}'.format(project_dir))
    return project_dir

def render_old_screws(SCREWMODELS, SCREWRADIUS, SCREWBODYLENGTH,
                  SCREWCOLORSMAP, haves, diff, axial, coronal, sagittal):
    have_nots, haves = check_model(haves)


    if len(have_nots) > 0:
        for i, name in enumerate(have_nots):
            print (f"[{i}/{len(have_nots)}]: creating by restoring {name}")
            screw = ScrewModel(name, SCREWRADIUS[name], SCREWBODYLENGTH[name], SCREWCOLORSMAP[name],
                               axial, coronal, sagittal)
            SCREWMODELS[name] = screw



############################################# Fixtures


class ScrewModel:

    def __init__(self, my_name, radius, length, skin_color,
                 axial, coronal, sagittal,
                 direction=SCREWDIRECTION,
                 viewpoint="midPoint"):

        self.direction = direction
        self.skin_color = skin_color
        self.radius = radius
        self.length = length
        self.name = my_name
        self.axial, self.coronal, self.sagittal = axial, coronal, sagittal
        self.viewpoint = viewpoint

        """
        when we reset the red, yellow or green view panel, it does not matter if we let the plane position point
        to be the mid point or the earlier intersection point.
        The point does not matter for visualization , only geometry
        The visualization is handled by the viewer which always center the view for the user

        """
        # self.viewpoint = "intersectionPoint"

        # grab a copy
        red, yellow, green = grab_planes()
        self.intersectionPoint = point_of_intersection(red, yellow, green)

        """


                if self.__length != "Select a length (mm)" and self.__diameter != "Select a diameter (mm)":
          self.screwPath = os.path.join(os.path.dirname(slicer.modules.pediclescrewsimulator.path), 'Resources/ScrewModels/scaled_' + self.__length + 'x' + self.__diameter + '.vtk')
          self.screwPath = self.screwPath.replace("\\","/")
          logging.debug("Screw file path: {0}".format(self.screwPath))
          self.__loadScrewButton.enabled = True

                  screwDescrip = ["0","0","0","0","0","0"]
        screwModel = slicer.modules.models.logic().AddModel(self.screwPath)
        if screwModel is None:
            logging.error("Failed to load screw model: "+self.screwPath)
            return

        matrix = vtk.vtkMatrix4x4()
        matrix.DeepCopy((1, 0, 0, self.coords[0],
                       0, -1, 0, self.coords[1],
                       0, 0, -1, self.coords[2],
                       0, 0, 0, 1))

        transformScrewTemp = slicer.vtkMRMLLinearTransformNode()
        transformScrewTemp.SetName("Transform-%s" % self.currentFidLabel)
        slicer.mrmlScene.AddNode(transformScrewTemp)
        transformScrewTemp.ApplyTransformMatrix(matrix)

        screwModel.SetName('Screw at point %s' % self.currentFidLabel)
        screwModel.SetAndObserveTransformNodeID(transformScrewTemp.GetID())

        modelDisplay = screwModel.GetDisplayNode()
        modelDisplay.SetColor(0.12,0.73,0.91)
        modelDisplay.SetDiffuse(0.90)
        modelDisplay.SetAmbient(0.10)
        modelDisplay.SetSpecular(0.20)
        modelDisplay.SetPower(10.0)
        modelDisplay.SetVisibility2D(True)
        screwModel.SetAndObserveDisplayNodeID(modelDisplay.GetID())



        """


        # self.cylinderSource = vtk.vtkCylinderSource()
        # self.cylinderSource_cap = vtk.vtkCylinderSource()

        # loadModel automatically creates or adds an actual model in slicer
        # self.cylinderSource = slicer.util.loadModel(os.path.join(SCREW_MODEL_FOLDER, thread))


        #
        self.modelsLogic = slicer.modules.models.logic()
        self.cylinderSource = None
        self.cylinderSource_cap = slicer.util.loadModel(os.path.join(SCREW_MODEL_FOLDER, cap))

        self.cylinderSource_cap.GetDisplayNode().SetVisibility2D(True)
        self.cylinderSource_cap.GetDisplayNode().SetSliceIntersectionThickness(1)
        self.cylinderSource_cap.GetDisplayNode().SetColor(self.skin_color[0], self.skin_color[1], self.skin_color[2])
        self.cylinderSource_cap.SetName(my_name + '_ScrewCap')

        # self.cylinderSource.GetDisplayNode().SetVisibility2D(True)
        # self.cylinderSource.GetDisplayNode().SetSliceIntersectionThickness(1)
        # self.cylinderSource.GetDisplayNode().SetColor(self.skin_color[0], self.skin_color[1], self.skin_color[2])
        # self.cylinderSource.SetName(my_name + '_ScrewBody')






        # # Create model node and add to scene
        # modelsLogic = slicer.modules.models.logic()
        # # https://discourse.slicer.org/t/simple-example-to-add-a-vtk-object-to-slicer-3d-view/4797
        # self.model = modelsLogic.AddModel(self.cylinderSource.GetOutputPort())
        # # self.model = modelsLogic.AddModel(self.cylinderSource.GetOutput())


        # self.model.GetDisplayNode().SetVisibility2D(True)
        # self.model.GetDisplayNode().SetSliceIntersectionThickness(1)
        # self.model.GetDisplayNode().SetColor(self.skin_color[0], self.skin_color[1], self.skin_color[2])
        # self.model.SetName(my_name + '_ScrewBody')

        # # self.model_cap = modelsLogic.AddModel(self.cylinderSource_cap.GetOutput())
        # self.model_cap = modelsLogic.AddModel(self.cylinderSource_cap.GetOutputPort())
        # self.model_cap.GetDisplayNode().SetVisibility2D(True)
        # self.model_cap.GetDisplayNode().SetSliceIntersectionThickness(1)
        # self.model_cap.GetDisplayNode().SetColor(self.skin_color[0], self.skin_color[1], self.skin_color[2])
        # self.model_cap.SetName(my_name + '_ScrewCap')

        # # our cap is of a standard size
        # self.cylinderSource_cap.SetHeight(15)
        # self.cylinderSource_cap.SetRadius(6.5)
        # self.cylinderSource_cap.SetResolution(100)

        # Create a Transform node for the model to copy the rotation
        self.cylinderTS = slicer.vtkMRMLTransformNode()
        self.cylinderTS_cap = slicer.vtkMRMLTransformNode()
        self.cylinderTS.SetName(my_name + '_Transform_Body')
        self.cylinderTS_cap.SetName(my_name + '_Transform_Cap')
        slicer.mrmlScene.AddNode(self.cylinderTS)
        slicer.mrmlScene.AddNode(self.cylinderTS_cap)

        # self.model.SetAndObserveTransformNodeID(self.cylinderTS.GetID())
        # self.model_cap.SetAndObserveTransformNodeID(self.cylinderTS_cap.GetID())

        # self.cylinderSource.SetAndObserveTransformNodeID(self.cylinderTS.GetID())
        self.cylinderSource_cap.SetAndObserveTransformNodeID(self.cylinderTS_cap.GetID())


        # # Get point list node from scene
        self.pointListNode = slicer.util.getNode(my_name)
        self.pointListNode.AddObserver(slicer.vtkMRMLMarkupsNode.PointModifiedEvent, self.update)

        self.update()

    def destruct(self):
        attributes = ["model", "model_cap", "cylinderTS_cap", "cylinderTS", "pointListNode", "cylinderSource", "cylinderSource_cap"]
        # for n in (self.model, self.model_cap, self.cylinderTS_cap, self.cylinderTS, self.pointListNode):
        for attribute in attributes:
            if hasattr(self, attribute):
                n = getattr(self, attribute)
                slicer.mrmlScene.RemoveNode(n)
        print('deleted ', self.name)

    def recalculate_planes(self, startPoint, endPoint):
        # better to turn the intersecting slices first
        # sliceDisplayNodes = slicer.util.getNodesByClass("vtkMRMLSliceDisplayNode")
        # for sliceDisplayNode in sliceDisplayNodes:
        #     sliceDisplayNode.SetIntersectingSlicesVisibility(0)
        # sliceDisplayNode.IntersectingSlicesInteractiveOn()


        # print("STOP orientate planes")

        if self.viewpoint == "midPoint":
            midPoint = (startPoint + endPoint) / 2
            orientate_planes(startPoint, endPoint, midPoint, self.axial, self.coronal, self.sagittal)
        else:
            raise NotImplementedError(f"Only viewpoint = midPoint is implemented, not {self.viewpoint}")
        # elif self.viewpoint == "intersectionPoint":
        #     orientate_planes(startPoint, endPoint, self.intersectionPoint, self.axial, self.coronal, self.sagittal)

        # for sliceDisplayNode in sliceDisplayNodes:
        #     sliceDisplayNode.SetIntersectingSlicesVisibility(1)
        #     sliceDisplayNode.IntersectingSlicesInteractiveOn()

    def reset_sliceNode(self):
        # print('reset {} sliceNode'.format(self.name))
        startPoint = np.array([0.0, 0.0, 0.0])
        endPoint = np.array([0.0, 0.0, 0.0])
        self.pointListNode.GetNthControlPointPosition(0, startPoint)
        self.pointListNode.GetNthControlPointPosition(1, endPoint)
        self.recalculate_planes(startPoint, endPoint)

    def minorTranslation(self, direction=1.0, plane=None, distance=0.5):
        # print('adjust translation {} sliceNode by {}'.format(self.name, distance))
        startPoint = np.array([0.0, 0.0, 0.0])
        endPoint = np.array([0.0, 0.0, 0.0])
        self.pointListNode.GetNthControlPointPosition(0, startPoint)
        self.pointListNode.GetNthControlPointPosition(1, endPoint)

        norm = grab_plane_norm(plane)

        startPoint = startPoint + direction * norm * distance
        endPoint = endPoint + direction * norm * distance

        self.pointListNode.SetNthControlPointPosition(0, startPoint[0], startPoint[1], startPoint[2])
        self.pointListNode.SetNthControlPointPosition(1, endPoint[0], endPoint[1], endPoint[2])

    def minorRotation(self, direction=1.0, plane=None, angle=0.1):
        # print('adjust rotation {} sliceNode by {}'.format(self.name, angle))
        startPoint = np.array([0.0, 0.0, 0.0])
        endPoint = np.array([0.0, 0.0, 0.0])
        self.pointListNode.GetNthControlPointPosition(0, startPoint)
        self.pointListNode.GetNthControlPointPosition(1, endPoint)

        norm = grab_plane_norm(plane)

        # create a rot by vec
        theta = direction * angle
        r = R.from_rotvec(theta * norm)
        m = r.as_matrix()
        # print(m)
        # apply

        endPoint2 = endPoint - startPoint
        endPoint2 = np.matmul(m, endPoint2)
        endPoint2 = endPoint2 + startPoint

        self.pointListNode.SetNthControlPointPosition(1, endPoint2[0], endPoint2[1], endPoint2[2])

        # self.update() # we have got an observer so this is redundant

    # Update the sphere from the control points
    def update(self, param1=None, param2=None):

        with slicer.util.RenderBlocker():

            # pointListNode = slicer.util.getNode("F")
            startPoint = np.array([0.0, 0.0, 0.0])
            endPoint = np.array([0.0, 0.0, 0.0])
            self.pointListNode.GetNthControlPointPosition(0, startPoint)
            self.pointListNode.GetNthControlPointPosition(1, endPoint)

            # centerPointCoord = (startPoint + endPoint)/2
            centerPointCoord = [0, 0.5, 0]
            centerPointCoord_cap = [0, 0, 0]  # we will account for the 7.5 shift later
            pointPositions = np.vstack((startPoint, endPoint))
            # length = np.sqrt(np.sum(np.square(np.diff(pointPositions, axis=0))))
            # length = 1.0

            # print("skip set cener, height, radius for now")


            # self.cylinderSource.RemoveObserver(self.cylinderTS)
            if self.cylinderSource is not None:
                # print("remove model and observer ?")
                slicer.mrmlScene.RemoveNode(self.cylinderSource)
            # print("load another mesh?")
            diameter = str(float(self.radius*2)).replace(".", "")
            length = str(int(self.length))
            # print("diameter = ", diameter, " length ", length)

            mesh_filepath = os.path.join(SCREW_MODEL_FOLDER, f"7300-T10{diameter}{length}.obj")
            if os.path.exists(mesh_filepath):
                self.cylinderSource = slicer.util.loadModel(mesh_filepath)
                # print(self.cylinderSource)
            else:
                # use a cylinder as a placeholder
                self.cylinderSource_vtk = vtk.vtkCylinderSource()
                self.cylinderSource_vtk.SetCenter(centerPointCoord)
                self.cylinderSource_vtk.SetHeight(self.length)
                self.cylinderSource_vtk.SetRadius(self.radius)
                self.cylinderSource_vtk.Update()

                # Create model node and add to scene
                self.cylinderSource = self.modelsLogic.AddModel(self.cylinderSource_vtk.GetOutputPort())





            self.cylinderSource.GetDisplayNode().SetVisibility2D(True)
            self.cylinderSource.GetDisplayNode().SetSliceIntersectionThickness(1)
            self.cylinderSource.GetDisplayNode().SetColor(self.skin_color[0], self.skin_color[1], self.skin_color[2])
            self.cylinderSource.SetName(self.name + '_ScrewBody')
            self.cylinderSource.SetAndObserveTransformNodeID(self.cylinderTS.GetID())


            # self.cylinderSource.SetCenter(centerPointCoord)
            # self.cylinderSource.SetHeight(self.length)
            # self.cylinderSource.SetRadius(self.radius)
            # self.cylinderSource.Update()

            # self.cylinderSource_cap.SetCenter(centerPointCoord_cap)
            # self.cylinderSource_cap.Update()

            # pointPositions = np.vstack((startPoint, endPoint))
            T, T1 = calculate_screw_transformation_matrix(pointPositions, self.length + 4, self.direction) # add the extra non thread portion ?

            rMatrix = mat4x4Gen(T)
            rMatrix1 = mat4x4Gen(T1)
            self.cylinderTS.SetMatrixTransformToParent(rMatrix)
            self.cylinderTS_cap.SetMatrixTransformToParent(rMatrix1)

            self.recalculate_planes(startPoint, endPoint)

            resultTableNode.Modified()



def create_parameter_table(properties = None):

    try:
        resultTableNode = slicer.util.getNode('Screw Config')

    except MRMLNodeNotFoundException:
        print('Creating Screw Config')

        resultTableNode = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLTableNode",
                                                             "Screw Config")

        col = resultTableNode.AddColumn(vtk.vtkStringArray())
        col.SetName('Names')
        col = resultTableNode.AddColumn(vtk.vtkDoubleArray())
        col.SetName('Diameter(mm')
        col = resultTableNode.AddColumn(vtk.vtkDoubleArray())
        col.SetName('Length(mm)')
        col = resultTableNode.AddColumn()
        col.SetName('Visible')
        col = resultTableNode.AddColumn()
        col.SetName('Add/Delete')

        # TODO: remoev save option?
        # col = resultTableNode.AddColumn()
        # col.SetName('Save')
        col = resultTableNode.AddColumn(vtk.vtkStringArray())
        col.SetName('SegLabels')

        resultTableNode.SetColumnType('Visible', vtk.VTK_BIT)
        resultTableNode.SetColumnType('Add/Delete', vtk.VTK_BIT)
        # resultTableNode.SetColumnType('Save', vtk.VTK_BIT)

        for c in range(len(SCREWNAMES)):
            resultTableNode.AddEmptyRow()
            resultTableNode.SetCellText(c, 0, SCREWNAMES[c])
            resultTableNode.SetCellText(c, 1, str(DEFAULT_SCREWRADIUS))
            resultTableNode.SetCellText(c, 2, str(DEFAULT_SCREWBODYLENGTH))
            label = SCREWNAMES[c][0:-1]
            resultTableNode.SetCellText(c, 5, str(VERTLABELTOID[label]))
            # resultTableNode.SetCellText(c, 6, str(VERTLABELTOID[label]))

    finally:

        ################ restore old screws by adding them
        if properties:
            # DEBUG: Only mark first 2 screws for restoration
            restored_count = 0
            for c in range(len(SCREWNAMES)):
                if SCREWNAMES[c] in properties:
                    # add these old screws back
                    resultTableNode.SetCellText(c,4, str(1))
                    # restored_count += 1
                    # # DEBUG: Break after marking first 2 screws
                    # if restored_count >= 10:
                    #     print(f'DEBUG: Only marked first {restored_count} screws for restoration')
                    #     break
            #         # break
            # else:
            #     raise RuntimeError ('we cannot find any old screw to display!')



        return resultTableNode



def UpdateOldScrews(resultTableNode):

    print("Update Old Screws")
    radius, length, visible, addDelete  = read_table(resultTableNode)
    SCREWRADIUS = {key: value for key, value in zip(SCREWNAMES, radius)}
    SCREWBODYLENGTH = {key: value for key, value in zip(SCREWNAMES, length)}

    # store the initial state
    if SCREWPROPERTY['radius'] is None:
        SCREWPROPERTY['radius'] = SCREWRADIUS
        if SCREWPROPERTY['length'] is None:
            SCREWPROPERTY['length'] = SCREWBODYLENGTH

    diff = detect_change(SCREWPROPERTY['radius'], SCREWRADIUS) + detect_change(SCREWPROPERTY['length'], SCREWBODYLENGTH)
    diff = set(diff)
    # print ('diff ', diff)
    SCREWPROPERTY['radius'] = SCREWRADIUS
    SCREWPROPERTY['length'] = SCREWBODYLENGTH

    haves = [name for i, name in zip(addDelete, SCREWNAMES) if i == 1]
    # only care about the changes made to those we have!!!
    haves = set(haves)
    diff.intersection_update(haves)
    print ('diff ', diff)

    """
    when restoring, we read the point list instead of updating it with current norm
    """
    render_old_screws(SCREWMODELS, SCREWRADIUS, SCREWBODYLENGTH,
                SCREWCOLORSMAP, haves, diff, AXIAL ,CORONAL, SAGITTAL)

def create_style_tables():

    """
    the style table is used to control the glyph size
    Only developers should use this
    """
    try:
        styleNode = slicer.util.getNode('Style')
    except MRMLNodeNotFoundException:
        print('Creating Style')

        # Create arrays to store results
        valueCol = vtk.vtkDoubleArray()
        valueCol.SetName('Values')
        labelCol = vtk.vtkStringArray()
        labelCol.SetName("Properties")

        styleNode = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLTableNode", "Style")
        styleNode.AddColumn(labelCol)
        styleNode.AddColumn(valueCol)

        # labelCol.InsertNextValue('Line Thickness')
        labelCol.InsertNextValue('Glyph Scale')

        # valueCol.InsertNextValue(1)
        valueCol.InsertNextValue(1.2)

        # Show table in view layout
        # slicer.app.layoutManager().setLayout(slicer.vtkMRMLLayoutNode.SlicerLayoutFourUpTableView)
        # slicer.app.applicationLogic().GetSelectionNode().SetReferenceActiveTableID(styleNode.GetID())
        # slicer.app.applicationLogic().PropagateTableSelection()


    finally:
        styleNode.AddObserver(vtk.vtkCommand.ModifiedEvent,
                      UpdatePointStyle)

        return styleNode


class SegContainer:

    def __init__(self, segNode=None, loadedVolumeNode=None):

        self.segNode = self.connect_to(segNode, type="vtkMRMLSegmentationNode")
        self.segmentation = self.segNode.GetSegmentation()
        self.segmentIds = self.segmentation.GetSegmentIDs()

        self.loadedVolumeNode = self.connect_to(loadedVolumeNode, type="vtkMRMLScalarVolumeNode")

        from collections import OrderedDict
        self.properties = OrderedDict()

        self.compute_centroid_ranges()

    def compute_centroid_ranges(self):
        print(f'computing centroid and range for {len(self.segmentIds)} segments')

        for current_seg in self.segmentIds:
            # Get segment as numpy array
            # note: the array is in ZYX, not XYZ, so our values are flipped against json
            segmentArray = slicer.util.arrayFromSegmentBinaryLabelmap(self.segNode,
                                                                      current_seg, self.loadedVolumeNode)
            # make life easier
            segmentArray = np.swapaxes(segmentArray, 0, -1)  # XYZ
            centroid, ranges = memoryLight_center_of_mass(segmentArray)
            print(f"{current_seg}: centroid {centroid} ranges {ranges}")

            self.properties[current_seg] = (centroid, ranges)

    def connect_to(self, segNode, type="vtkMRMLSegmentationNode"):

        if segNode is None:
            segNode = slicer.mrmlScene.GetFirstNodeByClass(type)
            if segNode is None:
                raise ValueError(f'No {type} Node is found')
        return segNode
########################################################################################################################### re-order segmentation

# Nodes
def write_colorNode(segNode, path):


    segmentation = segNode.GetSegmentation()
    segmentIds = segNode.GetSegmentation().GetSegmentIDs()

    segment_names_to_labels = []

    for item in segmentIds:
        print (item)
        seg = segmentation.GetSegment(item)
        # v = seg.GetLabelValue()
        tempName = seg.GetName()
        v = int(tempName.split('_')[-1])
        # the label has to be integer, not string  v = 'Z' + str(v)
        segment_names_to_labels.append((tempName, v)) # name change has no meaning as we can only encode label 123.

    print ("segment_names_to_labels ", segment_names_to_labels)

    # try:
    #     colorTableNode = slicer.mrmlScene.GetFirstNodeByClass("vtkMRMLColorTableNode")
    # except Exception as e:
    #     print (e, 'create color table Node')

    colorTableNode = slicer.mrmlScene.CreateNodeByClass("vtkMRMLColorTableNode")
    colorTableNode.SetTypeToUser()
    colorTableNode.HideFromEditorsOff()  # make the color table selectable in the GUI outside Colors module
    slicer.mrmlScene.AddNode(colorTableNode); colorTableNode.UnRegister(None)
    colorTableNode.SetNumberOfColors(29) # only 28 possible vertebrae
    colorTableNode.SetNamesInitialised(True) # prevent automatic color name generation



    for segmentName, labelValue in segment_names_to_labels:
        r = random.uniform(0.0, 1.0)
        g = random.uniform(0.0, 1.0)
        b = random.uniform(0.0, 1.0)
        a = 1.0
        print (labelValue, segmentName) # segmentName cannot be changed !
        success = colorTableNode.SetColor(labelValue, segmentName, r, g, b, a)


    # try:
        # labelmapVolumeNode = slicer.mrmlScene.GetFirstNodeByClass("vtkMRMLLabelMapVolumeNode")
    # except Exception as e:
        # print (e, 'create label map volume Node')
    labelmapVolumeNode = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLLabelMapVolumeNode")  # export to new labelmap volume

    referenceVolumeNode = None # it could be set to the master volume


    # this function is way too smart; it does not throw us an error if the ids do not exist in the color table
    # instead it automatically appends whatever new ids show up

    # so misleading, this function appears to use the segment Names instead of segment IDs as the keys to the lookup color table
    slicer.modules.segmentations.logic().ExportSegmentsToLabelmapNode(segNode, segmentIds, labelmapVolumeNode,
    referenceVolumeNode, slicer.vtkSegmentation.EXTENT_REFERENCE_GEOMETRY, colorTableNode)

    filepath = os.path.join(path, "testlabel.nrrd")
    if os.path.exists(filepath):
        print (f'{filepath} exits.')
        if OVERWRITE:
            slicer.util.saveNode(labelmapVolumeNode, filepath)
        else:
            print ('Abort!')
    else:
        slicer.util.saveNode(labelmapVolumeNode, filepath)


###########################
def reorder_dict_values(pairs, ALLOW_T13, ALLOW_L6, DISALLOW_T12):

    assert isinstance(pairs, dict)

    sortedPairs = sorted(pairs.items(), key=lambda x: int(x[0].split('_')[-1]))
    print ("sortedPairs = ", sortedPairs)

    current_id = sortedPairs[0][0]
    current_label = sortedPairs[0][1]

    modifiedPairs = [(current_id, current_label)]

    for pair in sortedPairs[1:]:

        next_id = pair[0]
        next_label = pair[1]

        if ALLOW_T13:
            if next_label == 28 and current_label == 19 or current_label == 28 and next_label == 20:
                print ('allowing for T13')
                new_label = next_label

            elif current_label == 19 and next_label != 28:
                print (f'at {current_label}, we have to reorder {next_label}')
                new_label = 28

            elif current_label == 28 and next_label != 20:
                print (f'at {current_label}, we have to reorder {next_label}')
                new_label = 20

            else:

                if next_label - current_label != 1:
                    print (f'at {current_label}, we have to reorder {next_label}')
                    new_label = current_label + 1
                else:
                    new_label = next_label

        elif DISALLOW_T12:

            if next_label - current_label != 1:
                print (f'at {current_label}, we have to reorder {next_label}')
                new_label = current_label + 1
            else:
                new_label = next_label

            if new_label == 19:
                print ('disallow T12')
                new_label = 20
        else:

            if next_label - current_label != 1:
                print (f'at {current_label}, we have to reorder {next_label}')
                new_label = current_label + 1
            else:
                new_label = next_label

        if ALLOW_T13:
            assert new_label <= 28, f"modifiedPairs = {modifiedPairs}"
        elif ALLOW_L6:
            assert new_label <= 25, f"modifiedPairs = {modifiedPairs}"
        else:
            assert new_label <= 24, f"modifiedPairs = {modifiedPairs}"

        current_label = new_label

        modifiedPairs.append((next_id, new_label))


    print ("modifiedPairs = ", modifiedPairs)
    return modifiedPairs

def what_name_should_the_first_be(IdNamePairs, segment_id, name, ALLOW_T13, DISALLOW_T12):

    keys = list(IdNamePairs)
    loc = keys.index(segment_id)
    print (f"{segment_id} is located at index {loc}")

    value = int(name.split('_')[-1])

    if ALLOW_T13:
        if value == 28:
            print ('observe T13')
            loc = loc + 8 # take 8 more away
        elif value <= 19:
            print ('Just before T13')
        elif value >= 20:
            loc = loc - 1 # take 1 less away

    elif DISALLOW_T12:
        if value >= 20:
            loc = loc + 1 # take away 1 more

    value = value - loc
    print ('the first should now be called ', value)
    return value



def snapshot(segNode=None, IdNamePairs=None):
    # global IdNamePairs
    if IdNamePairs is None:
        print("add a record of the segmentation ids to segmentation names")
        IdNamePairs = OrderedDict()

    segmentation = segNode.GetSegmentation()
    segmentIds = segNode.GetSegmentation().GetSegmentIDs()

    # we cannot rely on item because the ids are string and string are hard to follow in sequential order
    # explicitly sort the ids in the format of INT!
    segmentIds = sorted(segmentIds, key=lambda x: int(x.split('_')[-1]))

    # print ('segmentIds = ', segmentIds)

    for item in segmentIds:
        seg = segmentation.GetSegment(item)
        # color table automatically assigns the value to pixel correctly, no need to worry about value
        # v = seg.GetLabelValue()
        name = seg.GetName()
        IdNamePairs[item] = name

    return IdNamePairs


def detect_segment_change(IdNamePairs, segNode):
    # global IdNamePairs

    segmentation = segNode.GetSegmentation()

    for segment_id, old_name in IdNamePairs.items():
        try:
            seg = segmentation.GetSegment(segment_id)
            # color table automatically assigns the value to pixel correctly, no need to worry about value
            # v = seg.GetLabelValue()
            name = seg.GetName()

        except AttributeError as e:
            print(e, f'we have deleted {old_name}')
            print('update IdNamePairs now')
            IdNamePairs = snapshot(IdNamePairs, segNode)
            # just return the first so that we are effectively rename the first with its own name. simplify the code
            the_first_segment_id = list(IdNamePairs)[0]
            the_first_segment_name = IdNamePairs[the_first_segment_id]
            return IdNamePairs, the_first_segment_id, the_first_segment_name
        else:
            if name != old_name:
                print(f'found a change from {old_name} to {name}')
                return IdNamePairs, segment_id, name
    else:
        print('No segment name change detected')
    return None


def update_all_segments(IdNamePairs, segNode, ALLOW_T13, ALLOW_L6, DISALLOW_T12):
    ans = detect_segment_change(IdNamePairs, segNode)
    if ans is None:
        print('No refresh')
    else:
        # the_first_new_name = what_name_should_the_first_be(*detect_segment_name_change())
        the_first_new_name = what_name_should_the_first_be(*ans, ALLOW_T13=ALLOW_T13, DISALLOW_T12=DISALLOW_T12)
        the_first_new_name = 'Segment_' + str(the_first_new_name)
        the_first_segment_id = list(IdNamePairs)[0]
        the_first_old_name = IdNamePairs[the_first_segment_id]
        rename_segment(segNode, the_first_old_name, the_first_new_name, ALLOW_T13, ALLOW_L6, DISALLOW_T12)
        IdNamePairs = snapshot(segNode, IdNamePairs)

    return IdNamePairs


def segment_exists(segNode, segmentName='Segment_25', returnSegment=False, returnId=False):
    segmentation = segNode.GetSegmentation()
    segmentIds = segNode.GetSegmentation().GetSegmentIDs()

    # we cannot rely on item because the ids are string and string are hard to follow in sequential order
    # explicitly sort the ids in the format of INT!
    segmentIds = sorted(segmentIds, key=lambda x: int(x.split('_')[-1]))

    print('segmentIds = ', segmentIds)

    for item in segmentIds:
        seg = segmentation.GetSegment(item)
        # color table automatically assigns the value to pixel correctly, no need to worry about value explicitly
        # v = seg.GetLabelValue()
        name = seg.GetName()
        if name == segmentName:
            print(f'found {segmentName}')
            if returnSegment:
                return True, seg, segmentation, segmentIds
            elif returnId:
                return True, item, segmentation, segmentIds
            else:
                return True
    else:
        print(f'we do not have {segmentName}')
        if returnSegment:
            return False, None, None, None
        elif returnId:
            return False, None, None, None
        else:
            return False


# def remove_segment(segNode, ALLOW_T13, ALLOW_L6, DISALLOW_T12, segmentName='Segment_25'):
#     ans, segmentId, segmentation, segmentIds = segment_exists(segNode, segmentName, returnId=True)
#     if ans:
#         print(f'removing {segmentName}')
#         segNode.GetSegmentation().RemoveSegment(segmentId)
#
#     reorder(segNode, ALLOW_T13, ALLOW_L6, DISALLOW_T12)


def rename_segment(segNode, segmentName='Segment_25', newName='Segment_24',ALLOW_T13=False,
                   ALLOW_L6=False, DISALLOW_T12=False):
    ans, segment, segmentation, segmentIds = segment_exists(segNode, segmentName, returnSegment=True)
    if ans:
        print(f'renaming {segmentName} to {newName}')
        segment.SetName(newName)
        assert newName == segment.GetName(), "renaming fails"

    reorder(segNode, ALLOW_T13, ALLOW_L6, DISALLOW_T12)


def reorder(segNode,
            ALLOW_T13, ALLOW_L6, DISALLOW_T12):
    # safer to grab the information again
    segmentation = segNode.GetSegmentation()
    segmentIds = segNode.GetSegmentation().GetSegmentIDs()

    IdLabelPairs = {}

    for item in segmentIds:
        seg = segmentation.GetSegment(item)
        # color table automatically assigns the value to pixel correctly, no need to worry about value explicity
        # v = seg.GetLabelValue()
        name = seg.GetName()
        IdLabelPairs[item] = int(name.split('_')[-1])

    modifiedPairs = reorder_dict_values(IdLabelPairs, ALLOW_T13, ALLOW_L6, DISALLOW_T12)

    for pair in modifiedPairs:
        segment_id, new_name = pair

        old_name = IdLabelPairs[segment_id]

        if old_name == new_name:
            print(f'No modification requires for {segment_id}')
            continue
        else:
            new_name = 'Segment_' + str(new_name)
            segment = segNode.GetSegmentation().GetSegment(segment_id)
            segment.SetName(new_name)
            assert new_name == segment.GetName(), f"renaming fails for {segment_id}"










################################################################################################### Maths

def orientate_planes(startPoint, endPoint, midPoint, axial, coronal, sagittal):
    """
    use a vector to define our viewing direction or angle
    Note: we actually only just want to re-orientate yellow and green, not red


    :param startPoint: vector start point
    :param endPoint:  vector end point
    :param midPoint:  vector mid-point
    :param axial: Red panel
    :param coronal: Green  panel
    :param sagittal: Yellow panel
    :return:

    """
    screw_norm = endPoint - startPoint
    screw_norm /= np.linalg.norm(screw_norm)

    green_normal = coronal[0:3, 2]

    new = find_rotation_matrix(screw_norm, green_normal)

    sliceNode = {i: slicer.mrmlScene.GetNodeByID(f"vtkMRMLSliceNode{i}") for i in ["Red", "Yellow", "Green"]}

    n0 = -axial[0:3, 2]
    t = sagittal[0:3, 2]

    # check if the normal vector is perpendicular to the screw axis
    # print("before rotating the red plane ", np.dot(n, screw_norm))



    n = np.matmul(new, n0)

    # change_vector_red = np.dot(n0, screw_norm)
    # check if the normal vector is perpendicular to the screw axis
    # print("before rotating the red plane ", change_vector_red)

    # if the value is close to 0, it means we are perpendicular
    # it means are not not parallel, 1,
    # so we should not change the position of the plane
    # if np.abs(change_vector_red) < 0.05:
    #     se = sliceNode['Red'].GetSliceToRAS()
    #     se =  slicer.util.arrayFromVTKMatrix(se)
    #     sliceNode["Red"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], se[0,3], se[1,3], se[2,3], 0)

    # else:
    #     # sliceNode.SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], startPoint[0], startPoint[1], startPoint[2], 0)
    #     sliceNode["Red"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], midPoint[0], midPoint[1], midPoint[2], 0)

    sliceNode["Red"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], midPoint[0], midPoint[1], midPoint[2], 0)

    # sliceNode = slicer.mrmlScene.GetNodeByID("vtkMRMLSliceNodeYellow")

    n0 = sagittal[0:3, 2]
    t = -coronal[0:3, 2]

    # check if the normal vector is perpendicular to the screw axis
    # print("before rotating the yellow plane ", np.dot(n, screw_norm))

    n = np.matmul(new, n0)

    # change_vector_yellow = np.dot(n, screw_norm)
    # check if the normal vector is perpendicular to the screw axis
    # print("before rotating the yellow plane ", change_vector_yellow)

    # if np.abs(change_vector_yellow) < 0.05:
    #     se = sliceNode["Yellow"].GetSliceToRAS()
    #     se =  slicer.util.arrayFromVTKMatrix(se)
    #     sliceNode["Yellow"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], se[0,3], se[1,3], se[2,3], 0)
    # else:
    #     # sliceNode.SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], startPoint[0], startPoint[1], startPoint[2], 0)
    #     sliceNode["Yellow"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], midPoint[0], midPoint[1], midPoint[2], 0)

    sliceNode["Yellow"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], midPoint[0], midPoint[1], midPoint[2], 0)
    # sliceNode = slicer.mrmlScene.GetNodeByID("vtkMRMLSliceNodeGreen")

    n0 = coronal[0:3, 2]
    t = sagittal[0:3, 2]


    # check if the normal vector is perpendicular to the screw axis
    # print("before rotating the green plane ", np.dot(n, screw_norm))

    n = np.matmul(new, n0)

    # change_vector_green = np.dot(n, screw_norm)
    # check if the normal vector is perpendicular to the screw axis
    # print("before rotating the green plane ", change_vector_green)

    # if np.abs(change_vector_green) < 0.05:
    #     se = sliceNode["Green"].GetSliceToRAS()
    #     se =  slicer.util.arrayFromVTKMatrix(se)
    #     sliceNode["Green"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], se[0,3], se[1,3], se[2,3], 0)
    # else:
    #     # sliceNode.SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], startPoint[0], startPoint[1], startPoint[2], 0)
    #     sliceNode["Green"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], midPoint[0], midPoint[1], midPoint[2], 0)

    sliceNode["Green"].SetSliceToRASByNTP(n[0], n[1], n[2], t[0], t[1], t[2], midPoint[0], midPoint[1], midPoint[2], 0)


def find_rotation_matrix(new_norm, norm0):
    new_norm_L = np.linalg.norm(new_norm)
    new_norm /= new_norm_L
    # if new_norm_L != 1:
    #     print('normalize new norm')
    #     new_norm /= new_norm_L

    norm0_L = np.linalg.norm(norm0)
    norm0 /= norm0_L
    # if norm0_L != 1:
        # print('normalize norm 0')
        # norm0 /= norm0_L

    r, rmsd = R.align_vectors(new_norm[np.newaxis, :], norm0[np.newaxis, :])
    # print('finding rotation: rmsd = ', rmsd)
    # rv = r.as_rotvec()
    # print('rv = ', rv)
    # print(r.as_euler('xyz', degrees=True))

    '''
    by the definition on https://en.wikipedia.org/wiki/Axis%E2%80%93angle_representation#Rotation_vector,
    the angle is encapsulated in the length of the rotation vector

    '''
    return r.as_matrix()


def calculate_screw_transformation_matrix(pointPositions, length, screwDirection):
    '''
    our cylinder is described by the center point, not the bottom point.
    '''
    screw2, z = shift_to_zero(pointPositions)
    screw2 /= np.linalg.norm(screw2)

    r, rmsd = R.align_vectors(screw2[np.newaxis, :], screwDirection[np.newaxis, :])
    # # print ('rmsd = ', rmsd)

    # screw2 = pointPositions[1,:] - pointPositions[0,:]
    # screw2 /= np.linalg.norm(screw2)
    # # print (screw2)

    """
    because of the range sine operates, we run into trouble
    whenever angle is outside pi/2 ?
    """
    # rv = np.cross(screwDirection, screw2)
    # N = np.linalg.norm(rv) + 1e-5
    # theta = math.asin(N)
    # print("rotation magnitude")
    # print(theta*180/math.pi)
    # # print (N)
    # rv_theta = theta * rv / N
    # r = R.from_rotvec(rv_theta)

    # may be reductande now ?

    d = extend_move_backward(pointPositions, 7.5)
    body_center = extend_move_backward(pointPositions, -length / 2)

    T, T1 = np.eye(4), np.eye(4)
    T[0:3, 0:3] = r.as_matrix()
    T[0:3, 3] = body_center

    T1[0:3, 0:3] = r.as_matrix()
    T1[0:3, 3] = d

    return T, T1


def point_of_intersection(red, yellow, green):
    A = np.zeros((3, 3))
    b = np.zeros(3)

    A[0, :] = red[0:3, 2]
    A[1, :] = yellow[0:3, 2]
    A[2, :] = green[0:3, 2]

    b[0] = np.dot(red[0:3, 2], red[0:3, 3])
    b[1] = np.dot(yellow[0:3, 2], yellow[0:3, 3])
    b[2] = np.dot(green[0:3, 2], green[0:3, 3])

    x, residual, rank, s = np.linalg.lstsq(A, b, rcond=None)

    '''
    MUCH needed to solve for the intersection which may not be sitting at the center / the offset of anyone
    '''
    return x


def extend_move_backward(p, by):
    d = p[0, :] - p[1, :]
    d = by * (d / np.linalg.norm(d))
    d += p[0, :]
    return d


def shift_to_zero(x):
    """
    vector ab = point b - point a
    """

    z = np.copy(x[0, :])
    v = np.copy(x[1, :] - x[0, :])

    return v, z


def append_one(x):
    return np.concatenate((x, np.array((1,))), 0)


def memoryLight_center_of_mass(x):
    # boolean array is faster
    x = x.astype(bool, copy=False)
    idx = np.where(x)
    L = len(idx[0])
    N = min(5000, L)
    chosen = np.random.randint(0, L, size=N)  # fewer samples

    # for i in idx:
    #     print(len(i), chosen, i[chosen])

    centroid = tuple([np.mean(i[chosen]) for i in idx])
    ranges = [(np.min(i[chosen]), np.max(i[chosen])) for i in idx]

    return centroid, ranges


def find_a_point_North(centriod, ranges, ijkToRas):
    """
    Inputs are all in pixel, XYZ grid.

    only tested with NFYY CT, so may not work for others
    """
    centroid_ras = np.array((centriod[0], centriod[1], centriod[2], 1))
    centroid_ras = np.matmul(ijkToRas, centroid_ras)[0:3]

    startPoint = centroid_ras
    endPoint = np.array((centriod[0], ranges[1][0], centriod[2], 1))
    endPoint = np.matmul(ijkToRas, endPoint)[0:3]

    midPoint = (startPoint + endPoint) / 2

    return startPoint, endPoint, midPoint












####################################################################################
def check_range(x, upper, lower):
    up = x > upper
    low = x < lower
    return up, low


def print_warning(name, x, upper, lower):
    up, low = check_range(x, upper, lower)

    if np.any(low):
        print('\/\/\/\/\/\/\/::::: {} shorter than {} mm'.format(name, lower))
    if np.any(up):
        print('\/\/\/\/\/\/\/::::: {} longer than {} mm'.format(name, upper))


def issue_warnings(visible, name):
    s = np.sum(visible)
    if s > 1:
        warnings.warn(f'{name}: We can only handle 1 item at a time, but not {s}')


def read_table(resultTableNode):
    c = resultTableNode.GetTable().GetColumn(1)
    radius = vtk.util.numpy_support.vtk_to_numpy(c)
    # print_warning('Diameter', radius, 7,5)
    radius = radius / 2

    c = resultTableNode.GetTable().GetColumn(2)
    length = vtk.util.numpy_support.vtk_to_numpy(c)
    # print_warning('Length', length, 50, 35)

    c = resultTableNode.GetTable().GetColumn(3)
    visible = [c.GetValue(i) for i in range(len(length))]
    issue_warnings(visible, 'viewing')

    c = resultTableNode.GetTable().GetColumn(4)
    addDelete = [c.GetValue(i) for i in range(len(length))]

    # c = resultTableNode.GetTable().GetColumn(0)
    # screwNames = [c.GetValue(i) for i in range(len(length))]

    # c = resultTableNode.GetTable().GetColumn(5)
    # saving = any([c.GetValue(i) for i in range(len(length))])

    # property_values = np.array(valueCol)
    # return radius, length, visible, addDelete, saving
    # return screwNames, radius, length, visible, addDelete, property_values, saving
    return radius, length, visible, addDelete

def detect_change(d1, d2):
    assert len(d1) == len(d2)

    diff = []
    for key in d1.keys():
        v1, v2 = d1[key], d2[key]
        if v1 != v2:
            diff.append(key)

    return diff


def save_to_json(haves, SCREWRADIUS, SCREWBODYLENGTH,
                 outputDir=r"C:\slicer_data"):
    screw = np.array([0, -1, 0])
    print('saving to ', outputDir)

    def format_CUX_ijkToRas(t):
        ijkToRas = grab_ijkToRas(t)
        ijkToRas[0:3, 0:3] = np.sign(ijkToRas[0:3, 0:3])
        return ijkToRas.tolist()

    def calculate_screw_transformation_matrix(pointPositions, screw):

        # bug: not locking x and z axes
        screw2, z = shift_to_zero(pointPositions)
        screw2 /= np.linalg.norm(screw2)

        r, rmsd = R.align_vectors(screw2[np.newaxis, :], screw[np.newaxis, :])
        T = np.eye(4)
        T[0:3, 0:3] = r.as_matrix()
        T[0:3, 3] = z

        return T

    transformations = {}
    for name in haves:
        print(name)
        pointListNode = slicer.util.getNode(name)

        startPoint = np.array([0.0, 0.0, 0.0])
        endPoint = np.array([0.0, 0.0, 0.0])
        pointListNode.GetNthControlPointPosition(0, startPoint)
        pointListNode.GetNthControlPointPosition(1, endPoint)
        pointPositions = np.vstack((startPoint, endPoint))

        T = calculate_screw_transformation_matrix(pointPositions, screw)
        transformations[name] = {'matrix': T.tolist(),
                                 'radius': SCREWRADIUS[name],
                                 'length': SCREWBODYLENGTH[name],
                                 # 'RGB': SCREWCOLORSMAP[name]
                                 }

    transformations['ijkToRas'] = format_CUX_ijkToRas(slicer.util.getNodesByClass('vtkMRMLScalarVolumeNode')[0])

    with open(os.path.join(outputDir, 'transformation.json'), 'w') as f:
        jsonString = json.dumps(transformations)
        f.write(jsonString)

######################################### OHIF conversion functions

def ras_to_lps_transform(T_ras):
    """
    Convert a 4x4 transformation matrix from RAS to LPS coordinate system.

    CORRECTED: Applies flip matrix only ONCE on the left, not as a similarity transform.

    Parameters:
    -----------
    T_ras : numpy.ndarray
        4x4 transformation matrix in RAS coordinate system
        (e.g., from nibabel/3D Slicer)

    Returns:
    --------
    T_lps : numpy.ndarray
        4x4 transformation matrix in LPS coordinate system
        (e.g., for ITK)

    Formula:
    --------
    T_lps = M_flip @ T_ras

    where M_flip flips the first two axes (X and Y).

    References:
    -----------
    [1] https://stackoverflow.com/questions/71441883/how-to-get-transformation-affine-from-itk-registration/71485934
    [2] MONAI ITK loader implementation
    """
    # Validate input
    T_ras = np.asarray(T_ras, dtype=np.float64)
    if T_ras.shape != (4, 4):
        raise ValueError(f"Input must be a 4x4 matrix, got shape {T_ras.shape}")

    # Create the flip matrix: negates first two axes, keeps Z
    # This converts between LPS ↔ RAS coordinate systems
    M_flip = np.array([
        [-1,  0,  0,  0],
        [ 0, -1,  0,  0],
        [ 0,  0,  1,  0],
        [ 0,  0,  0,  1]
    ], dtype=np.float64)

    # Apply flip ONLY on the left (not sandwich formula!)
    T_lps = M_flip @ T_ras

    return T_lps


def lps_to_ras_transform(T_lps):
    """
    Convert a 4x4 transformation matrix from LPS to RAS coordinate system.

    This is the same operation as ras_to_lps_transform because the flip matrix
    is self-inverse: M_flip @ M_flip = I

    So: T_ras = M_flip @ T_lps

    Parameters:
    -----------
    T_lps : numpy.ndarray
        4x4 transformation matrix in LPS coordinate system (e.g., from ITK)

    Returns:
    --------
    T_ras : numpy.ndarray
        4x4 transformation matrix in RAS coordinate system
    """
    return ras_to_lps_transform(T_lps)


# Helper function to calculate camera position given focal point, view normal, and distance
def calculate_camera_position(focal_pt, view_normal, distance):
    """Camera looks toward the focal point along the negative view normal"""
    return focal_pt + view_normal * distance

# Helper function to calculate in-plane vector 2 (cross product)
def calculate_inplane_vector2(view_up, view_normal):
    """Calculate the second in-plane vector perpendicular to both view up and view normal"""
    vec2 = np.cross(view_up, view_normal)
    return vec2 / np.linalg.norm(vec2)  # Normalize

def calculate_slice_index(focal_point_lps, ijkToRas, ras_to_lps):
    # Convert IJK to LPS matrix for slice index calculation
    ijkToLps = np.matmul(ras_to_lps, ijkToRas)

    # Calculate IJK coordinates from focal point for slice indices
    focal_point_homogeneous = np.append(focal_point_lps, 1)
    ijk_coords = np.linalg.solve(ijkToLps, focal_point_homogeneous)
    return ijk_coords


def convert_position_screw_to_LPS(transformation_matrix, ijkToRas):
    """
    Convert a position from RAS to LPS coordinate system.

    """
    # Convert to numpy arrays if needed
    if not isinstance(transformation_matrix, np.ndarray):
        T_ras = np.array(transformation_matrix).reshape(4, 4)
    else:
        T_ras = transformation_matrix.copy()

    if not isinstance(ijkToRas, np.ndarray):
        ijkToRas = np.array(ijkToRas).reshape(4, 4)

    # Coordinate system conversion matrix: RAS to LPS
    # RAS: X=Right, Y=Anterior, Z=Superior
    # LPS: X=Left, Y=Posterior, Z=Superior
    ras_to_lps = np.array([
        [-1,  0,  0,  0],
        [ 0, -1,  0,  0],
        [ 0,  0,  1,  0],
        [ 0,  0,  0,  1]
    ])

    # Transform screw matrix from RAS to LPS
    T_lps = np.matmul(ras_to_lps, T_ras)

    # Extract rotation matrix and translation (focal point) in LPS

    focal_point_lps = T_lps[0:3, 3]
    return focal_point_lps

def convert_screw_to_ohif_viewport(
    screw_name,
    transformation_matrix,
    ijkToRas,
    frameOfReferenceUID="1.2.826.0.1.3680043.8.498.11285705374895339963569694290012006948",
    volumeId="cornerstoneStreamingImageVolume:default",
    parallelScale=234.20727282007405,
    cameraDistance=352,
    radius=0,
    length=0
):
    focal_point_lps = convert_position_screw_to_LPS(transformation_matrix, ijkToRas)

    # Convert to numpy arrays if needed
    if not isinstance(transformation_matrix, np.ndarray):
        T_ras = np.array(transformation_matrix).reshape(4, 4)
    else:
        T_ras = transformation_matrix.copy()


    # make sure we use this definition of screw axis direction
    screw = np.array([0, -1, 0])

    # Coordinate system conversion matrix: RAS to LPS
    # RAS: X=Right, Y=Anterior, Z=Superior
    # LPS: X=Left, Y=Posterior, Z=Superior
    ras_to_lps = np.array([
        [-1,  0,  0,  0],
        [ 0, -1,  0,  0],
        [ 0,  0,  1,  0],
        [ 0,  0,  0,  1]
    ])

    ijk_coords = calculate_slice_index(focal_point_lps, ijkToRas, ras_to_lps)

    T = ras_to_lps_transform(T_ras)

    full_T = np.eye(4)
    full_T[0:3, 0:3] = T[0:3, 0:3]
    full_T[0:3, 3] = focal_point_lps

    # ========================================
    # AXIAL VIEWPORT (mpr-axial / Red slice)
    # ========================================



    axial_viewup = np.array(T)[0:3, 1]
    axial_planeNormal = np.array(T)[0:3, 0]

    position = calculate_camera_position(focal_point_lps, axial_planeNormal, cameraDistance)
    viewport_rotation = 0

    axial_slice_index = int(round(ijk_coords[2]))  # K coordinate for axial
    axial_inplane_vec2 = calculate_inplane_vector2(axial_viewup,
                                                axial_planeNormal)

    axial_viewport = {
            "frameOfReferenceUID": frameOfReferenceUID,
            "camera": {
                "viewUp": axial_viewup.tolist(),
                "viewPlaneNormal": axial_planeNormal.tolist(),
                "position": position.tolist(),
                "focalPoint": focal_point_lps.tolist(),
                "parallelProjection": True,
                "parallelScale": parallelScale,
                "viewAngle": 90,
                "flipHorizontal": False,
                "flipVertical": False,
                "rotation": viewport_rotation
            },
            "viewReference": {
                "FrameOfReferenceUID": frameOfReferenceUID,
                "cameraFocalPoint": focal_point_lps.tolist(),
                "viewPlaneNormal": axial_planeNormal.tolist(),
                "viewUp": axial_viewup.tolist(),
                "sliceIndex": axial_slice_index,
                "planeRestriction": {
                    "FrameOfReferenceUID": frameOfReferenceUID,
                    "point": focal_point_lps.tolist(),
                    "inPlaneVector1": axial_viewup.tolist(),
                    "inPlaneVector2": {
                        "0": float(axial_inplane_vec2[0]),
                        "1": float(axial_inplane_vec2[1]),
                        "2": float(axial_inplane_vec2[2])
                    }
                },
                "volumeId": volumeId
            },
            "viewPresentation": {
                "rotation": viewport_rotation,
                "zoom": 1,
                "pan": [0, 0],
                "flipHorizontal": False,
                "flipVertical": False
            },
            "metadata": {
                "viewportId": "mpr-axial",
                "viewportType": "orthographic",
                "renderingEngineId": "OHIFCornerstoneRenderingEngine",
                "zoom": 1,
                "pan": [0, 0]
            }
        }

    # ========================================
    # SAGITTAL VIEWPORT (mpr-sagittal / Yellow slice)
    # ========================================

    sagittal_view_normal = np.array(T)[0:3, 2]
    sagittal_view_up = np.array(T)[0:3, 0]



    sagittal_camera_position = calculate_camera_position(focal_point_lps,
                                                         sagittal_view_normal, cameraDistance)
    sagittal_inplane_vec2 = calculate_inplane_vector2(sagittal_view_up,
                                                       sagittal_view_normal)
    sagittal_slice_index = int(round(ijk_coords[0]))  # I coordinate for sagittal



    sagittal_viewport = {
        "frameOfReferenceUID": frameOfReferenceUID,
        "camera": {
            "viewUp": sagittal_view_up.tolist(),
            "viewPlaneNormal": sagittal_view_normal.tolist(),
            "position": sagittal_camera_position.tolist(),
            "focalPoint": focal_point_lps.tolist(),
            "parallelProjection": True,
            "parallelScale": parallelScale,
            "viewAngle": 90,
            "flipHorizontal": False,
            "flipVertical": False,
            "rotation": viewport_rotation
        },
        "viewReference": {
            "FrameOfReferenceUID": frameOfReferenceUID,
            "cameraFocalPoint": focal_point_lps.tolist(),
            "viewPlaneNormal": sagittal_view_normal.tolist(),
            "viewUp": sagittal_view_up.tolist(),
            "sliceIndex": sagittal_slice_index,
            "planeRestriction": {
                "FrameOfReferenceUID": frameOfReferenceUID,
                "point": focal_point_lps.tolist(),
                "inPlaneVector1": sagittal_view_up.tolist(),
                "inPlaneVector2": {
                    "0": float(sagittal_inplane_vec2[0]),
                    "1": float(sagittal_inplane_vec2[1]),
                    "2": float(sagittal_inplane_vec2[2])
                }
            },
            "volumeId": volumeId
        },
        "viewPresentation": {
            "rotation": viewport_rotation,
            "zoom": 1,
            "pan": [0, 0],
            "flipHorizontal": False,
            "flipVertical": False
        },
        "metadata": {
            "viewportId": "mpr-sagittal",
            "viewportType": "orthographic",
            "renderingEngineId": "OHIFCornerstoneRenderingEngine",
            "zoom": 1,
            "pan": [0, 0]
        }
    }

    # ========================================
    # CORONAL VIEWPORT (mpr-coronal / Green slice)
    # ========================================

    coronal_view_normal = np.array(T)[0:3, 1]
    coronal_view_up = np.array(T)[0:3, 0]


    coronal_camera_position = calculate_camera_position(focal_point_lps,
                                                         coronal_view_normal, cameraDistance)
    coronal_inplane_vec2 = calculate_inplane_vector2(coronal_view_up, coronal_view_normal)
    coronal_slice_index = int(round(ijk_coords[1]))  # J coordinate for coronal



    coronal_viewport = {
        "frameOfReferenceUID": frameOfReferenceUID,
        "camera": {
            "viewUp": coronal_view_up.tolist(),
            "viewPlaneNormal": coronal_view_normal.tolist(),
            "position": coronal_camera_position.tolist(),
            "focalPoint": focal_point_lps.tolist(),
            "parallelProjection": True,
            "parallelScale": parallelScale,
            "viewAngle": 90,
            "flipHorizontal": False,
            "flipVertical": False,
            "rotation": viewport_rotation
        },
        "viewReference": {
            "FrameOfReferenceUID": frameOfReferenceUID,
            "cameraFocalPoint": focal_point_lps.tolist(),
            "viewPlaneNormal": coronal_view_normal.tolist(),
            "viewUp": coronal_view_up.tolist(),
            "sliceIndex": coronal_slice_index,
            "planeRestriction": {
                "FrameOfReferenceUID": frameOfReferenceUID,
                "point": focal_point_lps.tolist(),
                "inPlaneVector1": coronal_view_up.tolist(),
                "inPlaneVector2": {
                    "0": float(coronal_inplane_vec2[0]),
                    "1": float(coronal_inplane_vec2[1]),
                    "2": float(coronal_inplane_vec2[2])
                }
            },
            "volumeId": volumeId
        },
        "viewPresentation": {
            "rotation": viewport_rotation,
            "zoom": 1,
            "pan": [0, 0],
            "flipHorizontal": False,
            "flipVertical": False
        },
        "metadata": {
            "viewportId": "mpr-coronal",
            "viewportType": "orthographic",
            "renderingEngineId": "OHIFCornerstoneRenderingEngine",
            "zoom": 1,
            "pan": [0, 0]
        }
    }

    # Generate timestamp
    from datetime import datetime
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    # Combine all viewports into final output
    viewport_snapshot = {
        "name": screw_name,
        "timestamp": timestamp,
        "radius": radius,
        "length": length,
        "transform": full_T.tolist(),
        "viewports": [axial_viewport, sagittal_viewport, coronal_viewport]
    }

    return viewport_snapshot



def get_frame_of_reference_uid_from_volume(volumeNode):
    """
    Extract Frame of Reference UID from a volume node's DICOM metadata.

    Parameters:
    -----------
    volumeNode : vtkMRMLScalarVolumeNode
        The volume node containing DICOM metadata

    Returns:
    --------
    str or None : Frame of Reference UID if found, None otherwise
    """
    try:
        # Try multiple methods to get the Frame of Reference UID

        # Method 1: Direct attribute lookup
        frameOfRefUID = volumeNode.GetAttribute('DICOM.FrameOfReferenceUID')
        if frameOfRefUID:
            print(f"Found Frame of Reference UID from attributes: {frameOfRefUID}")
            return frameOfRefUID

        # Method 2: Through instance UID
        instanceUIDs = volumeNode.GetAttribute('DICOM.instanceUIDs')
        if instanceUIDs:
            # Get the first instance UID
            firstInstanceUID = instanceUIDs.split()[0] if ' ' in instanceUIDs else instanceUIDs

            # Try to access DICOM database
            import DICOMLib
            db = DICOMLib.DICOMDatabase()
            if db:
                # Query for Frame of Reference UID
                # This would require access to the DICOM database
                pass

        # Method 3: If pydicom is available, read from file
        try:
            import pydicom
            # Get the storage node to find the file path
            storageNode = volumeNode.GetStorageNode()
            if storageNode:
                filePath = storageNode.GetFileName()
                if filePath and os.path.exists(filePath):
                    dcm = pydicom.dcmread(filePath, stop_before_pixels=True)
                    if hasattr(dcm, 'FrameOfReferenceUID'):
                        frameOfRefUID = dcm.FrameOfReferenceUID
                        print(f"Found Frame of Reference UID from pydicom: {frameOfRefUID}")
                        return frameOfRefUID
        except ImportError:
            print("pydicom not available, cannot read DICOM file directly")
        except Exception as e:
            print(f"Failed to read DICOM with pydicom: {e}")

        return None

    except Exception as e:
        print(f"Error extracting Frame of Reference UID: {e}")
        return None


def save_screws_to_ohif_format(haves, SCREWRADIUS, SCREWBODYLENGTH,
                                outputDir=r"C:\slicer_data",
                                frameOfReferenceUID=None,
                                volumeId=None):
    """
    Save screw properties to OHIF/Cornerstone viewport snapshot format.

    Parameters:
    -----------
    haves : list
        List of screw names to export
    SCREWRADIUS : dict
        Dictionary mapping screw names to radii
    SCREWBODYLENGTH : dict
        Dictionary mapping screw names to lengths
    outputDir : str
        Output directory for the JSON file
    frameOfReferenceUID : str, optional
        DICOM Frame of Reference UID (can be looked up automatically from volume)
    volumeId : str, optional
        Cornerstone volume ID
    """
    screw = np.array([0, -1, 0])
    print('Saving screws to OHIF viewport format in:', outputDir)

    # Get volume node and IJK to RAS matrix
    volumeNode = slicer.util.getNodesByClass('vtkMRMLScalarVolumeNode')[0]
    ijkToRas = grab_ijkToRas(volumeNode)

    # Try to get Frame of Reference UID from DICOM if not provided
    if frameOfReferenceUID is None:
        frameOfReferenceUID = get_frame_of_reference_uid_from_volume(volumeNode)

        if frameOfReferenceUID is None:
            # Use a default/placeholder
            # frameOfReferenceUID = "1.2.826.0.1.3680043.8.498.11285705374895339963569694290012006948" # training mannequin
            frameOfReferenceUID = "1.2.826.0.1.3680043.8.498.86332697281993822957134910852142346599" # Chest CT
            print(f"Warning: Could not extract Frame of Reference UID from volume.")
            print(f"Using default placeholder: {frameOfReferenceUID}")
            print(f"Please update this value manually if needed for OHIF compatibility.")

    if volumeId is None:
        volumeId = "cornerstoneStreamingImageVolume:default"

    # Calculate transformation matrix for each screw
    def calculate_screw_transformation_matrix(pointPositions, screw, midPoint):
        screw2, z = shift_to_zero(pointPositions)
        screw2 /= np.linalg.norm(screw2)

        r, rmsd = R.align_vectors(screw2[np.newaxis, :], screw[np.newaxis, :])
        T = np.eye(4)
        T[0:3, 0:3] = r.as_matrix()
        T[0:3, 3] = midPoint # since slicer uses midpoint at the intersection, we follow the same convention

        return T

    # Create viewport snapshots for all screws
    viewport_snapshots = []

    for name in haves:
        print(f'Processing screw: {name}')
        pointListNode = slicer.util.getNode(name)

        startPoint = np.array([0.0, 0.0, 0.0])
        endPoint = np.array([0.0, 0.0, 0.0])
        pointListNode.GetNthControlPointPosition(0, startPoint)
        pointListNode.GetNthControlPointPosition(1, endPoint)
        pointPositions = np.vstack((startPoint, endPoint))

        midPoint = (endPoint + startPoint) / 2

        T = calculate_screw_transformation_matrix(pointPositions, screw, midPoint)

        # update the unit directional vectors so that the views are similar across slicer and OHIF

        model = SCREWMODELS[name]
        radius = model.radius
        length = model.length
        axial = model.axial
        sagittal = model.sagittal
        coronal = model.coronal


        screw_norm = endPoint - startPoint
        screw_norm /= np.linalg.norm(screw_norm)
        green_normal = coronal[0:3, 2]
        new = find_rotation_matrix(screw_norm, green_normal)

        n0 = -axial[0:3, 2] # axial normal is the same as screw x-axis


        n = np.matmul(new, n0)

        # update T
        T[0:3,2] = np.cross(n, screw_norm)
        T[0:3,0] = n


        # Convert to OHIF viewport format
        viewport_snapshot = convert_screw_to_ohif_viewport(
            screw_name=name,
            transformation_matrix=T,
            ijkToRas=ijkToRas,
            frameOfReferenceUID=frameOfReferenceUID,
            volumeId=volumeId,
            radius=radius,
            length=length
        )

        viewport_snapshots.append([name, viewport_snapshot])

    # Save to JSON file
    import json
    output_file = os.path.join(outputDir, 'viewport-snapshots-ohif.json')
    with open(output_file, 'w') as f:
        json.dump(viewport_snapshots, f, indent=2)

    print(f'Saved {len(viewport_snapshots)} viewport snapshots to: {output_file}')

    return viewport_snapshots


def locate_intersection(by):
    red, yellow, green = grab_planes()
    x = point_of_intersection(red, yellow, green)

    # assume the screw axis is the yellow line that is perpendicular to the green line
    p = np.zeros((2, 3))
    p[0, :] = x
    p[1, :] = x + green[0:3, 2]  # move in the green normal direction
    x2 = extend_move_backward(p, by=-by)

    return x, x2

def check_model(names):

    have_nots = []
    haves = []
    for name in names:
        try:
            slicer.util.getNode(name + "_ScrewBody")
        except MRMLNodeNotFoundException:
            print('we cannot find the Screwbody of ', name)
            have_nots.append(name)
        else:
            haves.append(name)

    return have_nots, haves

def find_or_make_up(name):
    try:
        pointListNode = slicer.util.getNode(name)
    except MRMLNodeNotFoundException:
        print('we cannot find {}, so we are creating it'.format(name))
        pointListNode = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLMarkupsFiducialNode")
        pointListNode.SetName(name)
    return pointListNode

def render_screws(SCREWMODELS, SCREWRADIUS, SCREWBODYLENGTH,
                  SCREWCOLORSMAP, haves, diff, axial, coronal, sagittal):
    '''
    users like to change config usually, so we always redraw screws.
    '''
    have_nots, haves = check_model(haves)

    if len(have_nots) > 0:
        for name in have_nots:
            # print('creating ', name)

            x, x2 = locate_intersection(SCREWBODYLENGTH[name])
            pointListNode = find_or_make_up(name)

            numControlPoints = pointListNode.GetNumberOfControlPoints()
            if numControlPoints == 2:
                '''
                we have already had a full point list, so update the values inside.
                '''
                pointListNode.SetNthControlPointPosition(0, x[0], x[1], x[2])
                pointListNode.SetNthControlPointPosition(1, x2[0], x2[1], x2[2])

            else:
                pointListNode.AddControlPoint(x)
                pointListNode.AddControlPoint(x2)

            # pointListDisplayNode = pointListNode.GetDisplayNode()
            # pointListDisplayNode.SetGlyphScale(property_values[0])

            screw = ScrewModel(name, SCREWRADIUS[name], SCREWBODYLENGTH[name], SCREWCOLORSMAP[name],
                               axial, coronal, sagittal)
            SCREWMODELS[name] = screw

    if len(diff) > 0:
        for name in diff:
            # print('Adding or redraw ', name)
            screw = SCREWMODELS[name]
            screw.length = SCREWBODYLENGTH[name]
            screw.radius = SCREWRADIUS[name]
            screw.update()
            SCREWMODELS[name] = screw

    return SCREWMODELS


def choose_what_to_show(to_be_reset, SCREWNAMES, SCREWMODELS,
                        VERTLABELTOID, IdNamePairs, ijkToRas, axial, coronal, sagittal, loadedVolumeNode, segContainer):
    """
    if we have a screw model, then
    go to the screw model

    else if we have the segmentation, then
    go to the centriod of the segment

    if we have right or left information,
    then shift the point proportionally

    finally, if there is nothing to show,
    pass
    """

    def go_to_vertebra(name, VERTLABELTOID, IdNamePairs, ijkToRas, axial, coronal, sagittal, loadedVolumeNode,
                       segContainer):

        # translate to vertebrae's id
        current_id = VERTLABELTOID[name]
        current_seg = 'Segment_' + str(current_id)

        # translate to segmentation's id
        NameIdPairs = {value: key for key, value in IdNamePairs.items()}
        current_seg2 = NameIdPairs.get(current_seg, None)

        if current_seg2 is None:
            warnings.warn(f'{current_seg2} does not exist in mask! mask contains only {NameIdPairs.keys()}')

        else:
            if current_seg2 in segContainer.properties:
                centroid, ranges = segContainer.properties[current_seg2]
                startPoint, endPoint, midPoint = find_a_point_North(centroid, ranges, ijkToRas)
                orientate_planes(startPoint, endPoint, midPoint, axial, coronal, sagittal)
            else:
                warnings.warn(f'{current_seg2} does not exist!')

    name = SCREWNAMES[to_be_reset]
    if name in SCREWMODELS:
        SCREWMODELS[name].reset_sliceNode()
        return

    if segContainer is not None:
        # remove the left right letter tag
        name, posTag = name[0:-1], name[-1]
        go_to_vertebra(name, VERTLABELTOID, IdNamePairs, ijkToRas, axial, coronal, sagittal, loadedVolumeNode, segContainer)


def grab_plane_matrix(planeNode):
    temp = vtk.vtkMatrix4x4()
    # planeNode.GetBaseToWorldMatrix(temp) # same SE3
    planeNode.GetObjectToWorldMatrix(temp)
    return slicer.util.arrayFromVTKMatrix(temp)


def grab_roi_matrix(planeNode):
    return slicer.util.arrayFromVTKMatrix(planeNode.GetObjectToWorldMatrix())


def from_LPI_to_RAS(Tras, Tlpi, to_dicom_from_camera):
    to_dicom_from_camera = np.matmul(Tras, np.matmul(np.linalg.inv(Tlpi), to_dicom_from_camera))
    return to_dicom_from_camera


def convert_RAS_to_LPI(Tras):
    Tlpi = np.copy(Tras)
    Tlpi[0, 3] *= -1
    Tlpi[1, 3] *= -1
    Tlpi[0, 0] *= -1
    Tlpi[1, 1] *= -1
    return Tlpi


def grab_ijkToRas(t):
    ijkToRas = vtk.vtkMatrix4x4()
    t.GetIJKToRASMatrix(ijkToRas)
    ijkToRas = slicer.util.arrayFromVTKMatrix(ijkToRas)
    # ijkToRas[0:3,0:3] = np.sign(ijkToRas[0:3,0:3])
    # return ijkToRas.tolist()
    return ijkToRas


def mat4x4Gen(m):
    rMatrix = vtk.vtkMatrix4x4()
    for x in range(4):
        for y in range(4):
            rMatrix.SetElement(x, y, m[x][y])
    return rMatrix


# def create_image_node(name, ap, se3=None, color=None, imageDirections=None, imageOrigin=None, imageSpacing=None):
#     ap = numpy_to_image(ap)
#     # name = 'projection_AP'
#     try:
#         volumeNode = slicer.util.getNode(name)
#     except MRMLNodeNotFoundException:
#         print ('we cannot find {}, so we are creating it'.format(name))
#         volumeNode = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLScalarVolumeNode")
#         volumeNode.SetName(name)
#         volumeNode.SetOrigin(imageOrigin)
#         volumeNode.SetSpacing(imageSpacing)
#         volumeNode.SetIJKToRASDirections(imageDirections)

#         volumeNode.CreateDefaultDisplayNodes()
#         volumeNode.CreateDefaultStorageNode()

#     finally:

#         # TODO: we need to find a way to incoperate the screen's SE3!
#         # if se3:
#         #     volumeNode.SetIJKToRASMatrix(se3)
#         # if color:
#         #     sliceNode = slicer.mrmlScene.GetNodeByID(f"vtkMRMLSliceNode{color}")
#         #     volumeNode.SetIJKToRASMatrix(sliceNode.GetXYToRAS())

#         volumeNode.SetAndObserveImageData(ap)

# def create_image_node2(name, ap, se3=None, color=None, imageDirections=None, imageOrigin=None, imageSpacing=None):
#     ap = numpy_to_image(ap)
#     # name = 'projection_AP'
#     try:
#         volumeNode = slicer.util.getNode(name)
#     except MRMLNodeNotFoundException:
#         print ('we cannot find {}, so we are creating it'.format(name))
#         volumeNode = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLScalarVolumeNode")
#         volumeNode.SetName(name)
#         volumeNode.SetOrigin(imageOrigin)
#         volumeNode.SetSpacing(imageSpacing)
#         # volumeNode.SetIJKToRASDirections(imageDirections)

#         volumeNode.CreateDefaultDisplayNodes()
#         volumeNode.CreateDefaultStorageNode()

#     finally:

#         # TODO: we need to find a way to incoperate the screen's SE3!
#         # if se3:
#         #     volumeNode.SetIJKToRASMatrix(se3)
#         # if color:
#         #     sliceNode = slicer.mrmlScene.GetNodeByID(f"vtkMRMLSliceNode{color}")
#         #     volumeNode.SetIJKToRASMatrix(sliceNode.GetXYToRAS())

#         volumeNode.SetAndObserveImageData(ap)

#     return volumeNode

def create_blank_image_node(name, imageDirections=None, imageOrigin=None, imageSpacing=None, data=None):
    try:
        volumeNode = slicer.util.getNode(name)
    except MRMLNodeNotFoundException:
        print(f'we cannot find {name}, so we are creating it with f{imageDirections}, f{imageOrigin}, f{imageSpacing}.')
        volumeNode = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLScalarVolumeNode")
        volumeNode.SetName(name)
        volumeNode.SetOrigin(imageOrigin)
        volumeNode.SetSpacing(imageSpacing)
        volumeNode.CreateDefaultDisplayNodes()
        volumeNode.CreateDefaultStorageNode()

        if isinstance(data, np.ndarray):
            volumeNode.SetAndObserveImageData(numpy_to_image(data))
    else:
        print(f'we have already got {name}.')

    return volumeNode


def update_volume_RAS(color, name, imageOrigin, imageSpacing):
    sliceNode = slicer.mrmlScene.GetNodeByID(f"vtkMRMLSliceNode{color}")
    volumeNode = slicer.util.getNode(name)
    volumeNode.SetIJKToRASMatrix(sliceNode.GetXYToRAS())
    volumeNode.SetOrigin(imageOrigin)
    volumeNode.SetSpacing(imageSpacing)


def numpy_to_image(numpy_array):
    # print (numpy_array)
    # print (numpy_array.dtype) # need to get the right data type !!!!!
    # print (numpy_array.min(), numpy_array.max())

    '''
    slicer draws the image with reversed Y axis in relation to dicom viewer, so we need to flipud here

    '''
    # numpy_array = np.flipud(numpy_array)

    """
    @brief Convert a numpy 2D or 3D array to a vtkImageData object
    @param numpy_array 2D or 3D numpy array containing image data
    @return vtkImageData with the numpy_array content
    """

    shape = numpy_array.shape
    if len(shape) < 2:
        raise Exception('numpy array must have dimensionality of at least 2')

    h, w = shape[0], shape[1]

    if len(shape) == 3:
        c = shape[2]
    else:
        c = 1

    # Reshape 2D image to 1D array suitable for conversion to a
    # vtkArray with numpy_support.numpy_to_vtk()
    linear_array = np.reshape(numpy_array, (w * h, c))
    vtk_array = vtk.util.numpy_support.numpy_to_vtk(linear_array)

    image = vtk.vtkImageData()
    image.SetDimensions(w, h, c)
    image.AllocateScalars(vtk.VTK_UNSIGNED_INT, 16)
    image.GetPointData().GetScalars().DeepCopy(vtk_array)

    return image


def grab_points(node):
    startPoint = np.array([0.0, 0.0, 0.0])
    endPoint = np.array([0.0, 0.0, 0.0])
    node.GetNthControlPointPosition(0, startPoint)
    node.GetNthControlPointPosition(1, endPoint)
    pointPositions = np.vstack((startPoint, endPoint))
    return pointPositions


def submit(url, data, session=None, method='POST', timeout=None):
    if session is None:
        try:
            if method == 'POST':
                response = requests.post(url=url, json=data, timeout=timeout)
            elif method == 'GET':
                response = requests.get(url, params=data, timeout=timeout)
            else:
                raise NotImplementedError('only GET or POST is valid, but not {}.'.format(method))

        except HTTPError as e:
            print(e)
            response = None
        except TimeoutError as e:
            print(e)
            print('waited for way too long > {}'.format(timeout))
            response = None

        else:
            status_code = response.status_code
            status_ok = response.ok

            print(f'The status code is {status_code}.')
            print(f'The response is {status_ok}.')

        return response

    else:
        try:
            if method == 'POST':
                response = session.post(url=url, json=data, timeout=timeout)
            elif method == 'GET':
                response = session.get(url, params=data, timeout=timeout)
            else:
                raise NotImplementedError('only GET or POST is valid, but not {}.'.format(method))

        except HTTPError as e:
            print(e)
            response = None
        except TimeoutError as e:
            print(e)
            print('waited for way too long > {}'.format(timeout))
            response = None
        except ConnectionError as e:
            print(e)
            response = None

        else:
            status_code = response.status_code
            status_ok = response.ok

            print(f'The status code is {status_code}.')
            print(f'The response is {status_ok}.')

        return response


# def duplicate_meta(target, source):

#     N = slicer.util.getNode(source)
#     outputVolumeSpacingMm = N.GetSpacing()
#     outputVolumeMarginMm =  N.GetOrigin()

#     O = slicer.util.getNode(target)
#     O.SetSpacing(outputVolumeSpacingMm)
#     O.SetOrigin(outputVolumeMarginMm)


def obtain_current_x(transformNode, spinner):
    # return [0]*6
    # return [2.691196896308986, -2.1857018690118837, -0.7598969030965009, -6.944338591402363, 38.172612325306275, 0.6654576262273277]
    rotationMatrix = vtk.vtkMatrix4x4()
    transformNode.GetMatrixTransformToParent(rotationMatrix)
    T = slicer.util.arrayFromVTKMatrix(rotationMatrix)
    current_x = spinner.from_matrix_to_theta(T)
    return current_x


# def read_table(cutOffCol):
#     # grab config
#     values = np.array(cutOffCol)
#     ap_carm_cutoff = values[0]
#     ap_drr_cutoff = values[1]
#     ml_carm_cutoff = values[2]
#     ml_drr_cutoff = values[3]

#     return ap_carm_cutoff, ap_drr_cutoff, ml_carm_cutoff, ml_drr_cutoff

def draw(subject, graphics, byte):
    import imageio.v3 as iio

    decoded = iio.imread(byte, extension='.png')
    print('decoded', decoded.shape)

    # web-picture is RGB
    # so not suitable!
    # decoded = decoded[:,:,0]

    if graphics.toggle_color:
        from components.optimizationUtils import flip_projection_color

        decoded = flip_projection_color(decoded)
    L = int(decoded.shape[1] / 2)

    node = slicer.mrmlScene.GetNodeByID(subject.imageNodes['projAP'])
    node.SetAndObserveImageData(numpy_to_image(decoded[:, 0:L]))

    node = slicer.mrmlScene.GetNodeByID(subject.imageNodes['projML'])
    node.SetAndObserveImageData(numpy_to_image(decoded[:, L:]))

    # images = {'ap': (, 'Red'),
    #         'ml': (decoded[:,L:], 'Green')}

    # # images = response.json()
    # # print (images)
    # for key,(value, panelColor) in images.items():
    #     helper_functions.create_image_node('drr_'+key, np.array(value), color=panelColor)
    #     # np.savetxt(os.path.join(test_dir, key + '_drr.txt'), np.array(value))
    #     DRR_ALBUM['drr_'+key].append(np.array(value))

    # slicer uses physical dimension for display so we must set meta correctly to make things look real
    # helper_functions.duplicate_meta(target='drr_ML', source='ml')
    # helper_functions.duplicate_meta(target='drr_AP', source='ap')


def lockscreen():
    """
    update this from layoutManager to something else
    """
    ################### disable 3d left click + drag ###############333
    threeDViewWidget = slicer.app.layoutManager().threeDWidget(0)
    markupsDisplayableManager = threeDViewWidget.threeDView().displayableManagerByClassName(
        'vtkMRMLMarkupsDisplayableManager')

    markupsDisplayNodes = slicer.util.getNodesByClass("vtkMRMLMarkupsDisplayNode")
    for markupsDisplayNode in markupsDisplayNodes:
        markupsWidget = markupsDisplayableManager.GetWidget(markupsDisplayNode)
        # Remove old mapping from left-click-and-drag
        markupsWidget.SetEventTranslationClickAndDrag(markupsWidget.WidgetStateOnWidget,
                                                      vtk.vtkCommand.LeftButtonPressEvent, vtk.vtkEvent.NoModifier,
                                                      markupsWidget.WidgetStateTranslateControlPoint,
                                                      vtk.vtkWidgetEvent.NoEvent, vtk.vtkWidgetEvent.NoEvent)
        # Keep responding to left-click event (for this we need to process left button press/release events)
        markupsWidget.SetEventTranslation(markupsWidget.WidgetStateOnWidget, vtk.vtkCommand.LeftButtonPressEvent,
                                          vtk.vtkEvent.NoModifier, markupsWidget.WidgetEventReserved)
        markupsWidget.SetEventTranslation(markupsWidget.WidgetStateOnWidget, vtk.vtkCommand.LeftButtonReleaseEvent,
                                          vtk.vtkEvent.NoModifier, markupsWidget.WidgetEventReserved)
        # Make Alt + left-click-and-drag move a control point
        markupsWidget.SetEventTranslationClickAndDrag(markupsWidget.WidgetStateOnWidget,
                                                      vtk.vtkCommand.LeftButtonPressEvent, vtk.vtkEvent.AltModifier,
                                                      markupsWidget.WidgetStateTranslateControlPoint,
                                                      markupsWidget.WidgetEventControlPointMoveStart,
                                                      markupsWidget.WidgetEventControlPointMoveEnd)


def grab_planes():

    """
    update this from layoutManager to something else
    """

    if slicer.app.layoutManager():
        sliceNode = slicer.app.layoutManager().sliceWidget("Red").mrmlSliceNode()
        sliceToRas = sliceNode.GetSliceToRAS()
        red = slicer.util.arrayFromVTKMatrix(sliceToRas)

        sliceNode = slicer.app.layoutManager().sliceWidget("Yellow").mrmlSliceNode()
        sliceToRas = sliceNode.GetSliceToRAS()
        yellow = slicer.util.arrayFromVTKMatrix(sliceToRas)

        sliceNode = slicer.app.layoutManager().sliceWidget("Green").mrmlSliceNode()
        sliceToRas = sliceNode.GetSliceToRAS()
        green = slicer.util.arrayFromVTKMatrix(sliceToRas)



    else:



        sliceNode = slicer.mrmlScene.GetSingletonNode("Red", "vtkMRMLSliceNode")
        sliceToRas = sliceNode.GetSliceToRAS()
        red = slicer.util.arrayFromVTKMatrix(sliceToRas)

        sliceNode = slicer.mrmlScene.GetSingletonNode("Yellow", "vtkMRMLSliceNode")
        sliceToRas = sliceNode.GetSliceToRAS()
        yellow = slicer.util.arrayFromVTKMatrix(sliceToRas)

        sliceNode = slicer.mrmlScene.GetSingletonNode("Green", "vtkMRMLSliceNode")
        sliceToRas = sliceNode.GetSliceToRAS()
        green = slicer.util.arrayFromVTKMatrix(sliceToRas)

    return red, yellow, green

def grab_plane_norm(plane:str):

    """
    update this from layoutManager to something else
    """

    if slicer.app.layoutManager():

        if plane == 'red':
            # find out the screw's red plane or axial plane
            # get red norm
            # norm = self.axial[:, 2]
            sliceNode = slicer.app.layoutManager().sliceWidget("Red").mrmlSliceNode()
            sliceToRas = sliceNode.GetSliceToRAS()
            red = slicer.util.arrayFromVTKMatrix(sliceToRas)
            norm = red[0:3, 2]
        elif plane == 'yellow':
            # norm = self.coronal[:, 2]
            sliceNode = slicer.app.layoutManager().sliceWidget("Yellow").mrmlSliceNode()
            sliceToRas = sliceNode.GetSliceToRAS()
            yellow = slicer.util.arrayFromVTKMatrix(sliceToRas)
            norm = yellow[0:3, 2]
        elif plane == 'green':
            # norm = self.sagittal[:, 2]
            sliceNode = slicer.app.layoutManager().sliceWidget("Green").mrmlSliceNode()
            sliceToRas = sliceNode.GetSliceToRAS()
            green = slicer.util.arrayFromVTKMatrix(sliceToRas)
            norm = green[0:3, 2]
        else:
            raise RuntimeError()
    else:

        if plane == 'red':
            # find out the screw's red plane or axial plane
            # get red norm
            # norm = self.axial[:, 2]
            sliceNode = slicer.mrmlScene.GetSingletonNode("Red", "vtkMRMLSliceNode")
            sliceToRas = sliceNode.GetSliceToRAS()
            red = slicer.util.arrayFromVTKMatrix(sliceToRas)
            norm = red[0:3, 2]
        elif plane == 'yellow':
            # norm = self.coronal[:, 2]
            sliceNode = slicer.mrmlScene.GetSingletonNode("Yellow", "vtkMRMLSliceNode")
            sliceToRas = sliceNode.GetSliceToRAS()
            yellow = slicer.util.arrayFromVTKMatrix(sliceToRas)
            norm = yellow[0:3, 2]
        elif plane == 'green':
            # norm = self.sagittal[:, 2]
            sliceNode =slicer.mrmlScene.GetSingletonNode("Green", "vtkMRMLSliceNode")
            sliceToRas = sliceNode.GetSliceToRAS()
            green = slicer.util.arrayFromVTKMatrix(sliceToRas)
            norm = green[0:3, 2]
        else:
            raise RuntimeError()

    return norm




def UpdatePointStyle(observer=None, eventid=None):
    global styleNode, SCREWMODELS

    col = styleNode.GetTable().GetColumn(1)  # column 0 is property name
    for name in SCREWMODELS:
        try:
            pointListNode = slicer.util.getNode(name)
        except MRMLNodeNotFoundException:
            warnings.warn('we cannot find pointList node for {}'.format(name))
        else:
            pointListDisplayNode = pointListNode.GetDisplayNode()
            pointListDisplayNode.SetGlyphScale(col.GetValue(0))


def UpdateScrewStyle(observer=None, eventid=None):
    # global SCREWNAMES, SCREWMODELS, SCREWPROPERTY, VERTLABELTOID
    # global segNode, ijkToRas, axial, coronal, sagittal, loadedVolumeNode, resultTableNode
    # global segContainer, IdNamePairs

    # radius, length, visible, addDelete, saving = read_table(resultTableNode)
    radius, length, visible, addDelete  = read_table(resultTableNode)
    SCREWRADIUS = {key: value for key, value in zip(SCREWNAMES, radius)}
    SCREWBODYLENGTH = {key: value for key, value in zip(SCREWNAMES, length)}

    # store the initial state
    if SCREWPROPERTY['radius'] is None:
        SCREWPROPERTY['radius'] = SCREWRADIUS
        if SCREWPROPERTY['length'] is None:
            SCREWPROPERTY['length'] = SCREWBODYLENGTH

    diff = detect_change(SCREWPROPERTY['radius'], SCREWRADIUS) + detect_change(SCREWPROPERTY['length'], SCREWBODYLENGTH)
    diff = set(diff)
    # print ('diff ', diff)
    SCREWPROPERTY['radius'] = SCREWRADIUS
    SCREWPROPERTY['length'] = SCREWBODYLENGTH

    haves = [name for i, name in zip(addDelete, SCREWNAMES) if i == 1]
    # only care about the changes made to those we have!!!
    haves = set(haves)
    diff.intersection_update(haves)
    # print ('diff ', diff)

    render_screws(SCREWMODELS, SCREWRADIUS, SCREWBODYLENGTH,
                SCREWCOLORSMAP, haves, diff, AXIAL ,CORONAL, SAGITTAL)

    to_be_removed = [name for i, name in zip(addDelete, SCREWNAMES) if i == 0 and name in SCREWMODELS]
    for name in to_be_removed:
        s = SCREWMODELS.pop(name)
        s.destruct()
    try:
        to_be_reset = visible.index(1)
    except Exception:
        pass
    else:
        choose_what_to_show(to_be_reset, SCREWNAMES, SCREWMODELS, VERTLABELTOID,
                            IdNamePairs, ijkToRas, AXIAL ,CORONAL, SAGITTAL, loadedVolumeNode, segContainer)
        resultTableNode.SetCellText(to_be_reset, 3, "0")

    # if saving:
    if AUTOSAVE:
        save_to_json(haves, SCREWRADIUS, SCREWBODYLENGTH)
        # Also save in OHIF format
        try:
            save_screws_to_ohif_format(haves, SCREWRADIUS, SCREWBODYLENGTH)
        except Exception as e:
            print(f"Warning: Failed to save OHIF format: {e}")
        # resultTableNode.SetCellText(5, 5, "0")  # hard code this!

    # resultTableNode.RemoveObserver(tableObserver)
    # clear column
    # c = 0
    # for i in range(1,6):
    #     for j in ['L', 'R']:
    #         resultTableNode.SetCellText(c,3,"0")
    #         c = c + 1
    # for name in to_be_reset:
    #     i = SCREWIDS[name]
    #     resultTableNode.SetCellText(i,3,"0")

    # we have to lock everything again
    lockscreen()

############################################### GUI

def hide_panels():
    main = slicer.util.mainWindow()
    main.menuBar().hide()
    main.statusBar().hide()

    slicer.util.setModuleHelpSectionVisible(False)
    slicer.util.setDataProbeVisible(False)
    setApplicationLogoVisible(scaleFactor=0.5)
    # slicer.util.findChild(main, "LogoLabel").visible = False

def draw_layout():

    """
    update this from layoutManager to something else
    """


    if CUSTOMLAYOUT:
        customLayout = """
        <layout type="vertical" split="true" >
        <item splitSize="500">
        <layout type="vertical">
        <item>
        <layout type="horizontal">
        <item>
            <view class="vtkMRMLSliceNode" singletontag="Red">
            <property name="orientation" action="default">Axial</property>
            <property name="viewlabel" action="default">R</property>
            <property name="viewcolor" action="default">#F34A33</property>
            </view>
        </item>
        <item>
            <view class="vtkMRMLTableViewNode" singletontag="TableView1">
                <property name="viewlabel" action="default">T</property>
            </view>
        </item>
        </layout>
        </item>
        <item>
        <layout type="horizontal">
        <item>
            <view class="vtkMRMLSliceNode" singletontag="Green">
            <property name="orientation" action="default">Coronal</property>
            <property name="viewlabel" action="default">G</property>
            <property name="viewcolor" action="default">#6EB04B</property>
            </view>
        </item>
        <item>
            <view class="vtkMRMLSliceNode" singletontag="Yellow">
            <property name="orientation" action="default">Sagittal</property>
            <property name="viewlabel" action="default">Y</property>
            <property name="viewcolor" action="default">#EDD54C</property>
            </view>
        </item>
        </layout>
        </item>
        </layout>
        </item>
        </layout>

        """

        # Built-in layout IDs are all below 100, so you can choose any large random number
        # for your custom layout ID.
        twoDLayoutID = 100

        if slicer.app.layoutManager():
            # works only with main windows
            layoutManager = slicer.app.layoutManager()
            layoutManager.layoutLogic().GetLayoutNode().AddLayoutDescription(twoDLayoutID, customLayout)

            ## Switch to the new custom layout
            layoutManager.setLayout(twoDLayoutID)
            # Show table in view layout
            try:
                resultTableNode = slicer.util.getNode("Screw Config")
            except MRMLNodeNotFoundException:
                print('No Screw Config')
            else:
                slicer.app.applicationLogic().GetSelectionNode().SetReferenceActiveTableID(resultTableNode.GetID())
                slicer.app.applicationLogic().PropagateTableSelection()

        else:
            layoutNode = slicer.mrmlScene.GetFirstNodeByClass("vtkMRMLLayoutNode")
            layoutNode.AddLayoutDescription(twoDLayoutID, customLayout)
            layoutNode.SetViewArrangement(twoDLayoutID)



    else:

        # customLayout = """
        # <layout type="horizontal" split="true">
        # 	<item>
        # 		<view class="vtkMRMLSliceNode" singletontag="Red">
        # 			<property name="orientation" action="default">Axial</property>
        # 			<property name="viewlabel" action="default">R</property>
        # 			<property name="viewcolor" action="default">#F34A33</property>
        # 		</view>
        # 	</item>
        # 	<item>
        # 		<view class="vtkMRMLSliceNode" singletontag="Yellow">
        # 			<property name="orientation" action="default">Sagittal</property>
        # 			<property name="viewlabel" action="default">Y</property>
        # 			<property name="viewcolor" action="default">#F34A33</property>
        # 		</view>
        # 	</item>
        # 	<item>
        # 		<view class="vtkMRMLSliceNode" singletontag="Green">
        # 			<property name="orientation" action="default">Coronal</property>
        # 			<property name="viewlabel" action="default">G</property>
        # 			<property name="viewcolor" action="default">#F34A33</property>
        # 		</view>
        # 	</item>
        # </layout>

        if slicer.app.layoutManager():
            layoutManager = slicer.app.layoutManager()
            layoutManager.setLayout(slicer.vtkMRMLLayoutNode.SlicerLayoutFourUpView)
            for sliceViewName in layoutManager.sliceViewNames():
                controller = layoutManager.sliceWidget(sliceViewName).sliceController()
                controller.setSliceVisible(True)
                # controller.setSliceVisible(False)
        else:
            layoutManager = slicer.qMRMLLayoutWidget()
            layoutManager.setMRMLScene(slicer.mrmlScene)
            # layoutManager.setLayout(slicer.vtkMRMLLayoutNode.SlicerLayoutOneUpRedSliceView) # slicer.vtkMRMLLayoutNode.SlicerLayoutOneUp3DView
            layoutManager.setLayout(slicer.vtkMRMLLayoutNode.SlicerLayoutFourUpView)
            for sliceViewName in layoutManager.sliceViewNames():
                controller = layoutManager.sliceWidget(sliceViewName).sliceController()
                controller.setSliceVisible(True)

##################### where is the sky for the screw / star
def push_towards_sky(scale=1.5):
    red, yellow, green = grab_planes()

    x = point_of_intersection(red, yellow, green)
    green_norm = green[0:3, 2]

    p1 = x + green_norm * 50
    p2 = p1 - 3 * green_norm

    p3, p4 = add_wings(p2, yellow, scale)

    return p1, p3, p4

def create_cone_direction_pointer():

    coneHeight = 18
    coneRadius = 6
    pointerCone = vtk.vtkConeSource()
    # pointerCone.SetCenter([coneHeight/2,coneRadius,0]) # not needed !
    pointerCone.SetCenter([0,0,0])
    pointerCone.SetHeight(coneHeight)
    pointerCone.SetRadius(coneRadius)
    pointerCone.SetResolution(10)
    pointerCone.Update()



    modelsLogic = slicer.modules.models.logic()
    coneSource = modelsLogic.AddModel(pointerCone.GetOutputPort())

    coneSource.GetDisplayNode().SetVisibility2D(True)
    coneSource.GetDisplayNode().Visibility3DOff()
    # coneSource.GetDisplayNode().SetVisibility(False) # cannot just turn off 3D
    coneSource.GetDisplayNode().SetSliceIntersectionThickness(1)
    coneSource.GetDisplayNode().SetColor(1,1,0)
    coneSource.SetName("cone")


    coneT = slicer.vtkMRMLTransformNode()
    coneT.SetName('Transform_Cone')
    slicer.mrmlScene.AddNode(coneT)
    coneSource.SetAndObserveTransformNodeID(coneT.GetID())
    return coneSource, coneT, pointerCone

def showConeAngle(coneT, unused1=None, unused2=None):

    fromDirection = np.array([1, 0, 0]) # cone native direction
    toDirection = grab_plane_norm('green')
    r, rmsd = R.align_vectors(toDirection[np.newaxis, :], fromDirection[np.newaxis, :])
    T = np.eye(4)
    T[0:3,0:3] = r.as_matrix()
    red, yellow, green = grab_planes()
    x = point_of_intersection(red, yellow, green)

    # include offset
    x = x + toDirection * 70
    T[0:3, 3] = x

    # fake_trans = np.array([0,0,60])
    # fake_T = np.eye(4)
    # fake_T[0:3, 3] = fake_trans

    # T = np.matmul(fake_T, T)

    rMatrix = mat4x4Gen(T)
    coneT.SetMatrixTransformToParent(rMatrix)

def ShowAngle(unused1=None, unused2=None):
    # print ('altered!')

    wing1 = slicer.util.getNode('Wing1')
    wing2 = slicer.util.getNode('Wing2')
    p1, p3, p4 = push_towards_sky()
    wing1.SetNthControlPointPosition(0, p1[0], p1[1], p1[2])
    wing1.SetNthControlPointPosition(1, p3[0], p3[1], p3[2])
    wing2.SetNthControlPointPosition(0, p1[0], p1[1], p1[2])
    wing2.SetNthControlPointPosition(1, p4[0], p4[1], p4[2])


def add_wings(x, yellow, scale):
    yellow_norm = scale * yellow[0:3, 2]
    return x - yellow_norm, x + yellow_norm


def draw_wings_on_slicingPlane():
    wing1 = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLMarkupsLineNode")
    wing1.SetName('Wing1')
    wing1.GetMeasurement('length').SetEnabled(False)

    wing2 = slicer.mrmlScene.AddNewNodeByClass("vtkMRMLMarkupsLineNode")
    wing2.SetName('Wing2')
    wing2.GetMeasurement('length').SetEnabled(False)

    p1, p3, p4 = push_towards_sky()

    wing1.AddControlPoint(p1)
    wing2.AddControlPoint(p1)

    wing1.AddControlPoint(p3)
    wing2.AddControlPoint(p4)

    wing1.SetLocked(1)
    wing2.SetLocked(1)

    for node in [wing1, wing2]:
        display = node.GetDisplayNode()
        display.SetGlyphScale(2)
        display.SetTextScale(0)
        # display.SetColor(1,1,0) # not working
        display.SetSelectedColor(1, 1, 0)
        display.SetGlyphTypeFromString("Vertex2D")

    for item in ["vtkMRMLSliceNodeGreen", "vtkMRMLSliceNodeYellow", "vtkMRMLSliceNodeRed"]:
        sliceNode = slicer.mrmlScene.GetNodeByID(item)
        sliceNode.AddObserver(vtk.vtkCommand.ModifiedEvent, ShowAngle)

def draw_cone_on_slicingPlane():

    coneSource, coneT, pointerCone = create_cone_direction_pointer()
    showConeAngle2 = partial(showConeAngle, coneT)
    for item in ["vtkMRMLSliceNodeGreen", "vtkMRMLSliceNodeYellow", "vtkMRMLSliceNodeRed"]:
        sliceNode = slicer.mrmlScene.GetNodeByID(item)
        sliceNode.AddObserver(vtk.vtkCommand.ModifiedEvent, showConeAngle2)



# def draw_GUI():

#     uiWidget = slicer.util.loadUI(UIPATH)

#     mainWidget = QWidget()
#     mainWidget.setWindowTitle("Pedicle Screw Insertion Planning")
#     mainWidget.setWindowIcon(QIcon(WINDOWICONPATH))


#     hlayout = QHBoxLayout()
#     mainWidget.setLayout(hlayout)
#     hlayout.addWidget(uiWidget, 1)

#     # splitter between "layout" and "bottom frame"
#     splitter = QSplitter()

#     splitter.orientation = Qt.Horizontal
#     hlayout.addWidget(splitter, 4)

#     # apply here, avoid changing the viewers ? NO it seems it works consistently everywhere.
#     # maybe all changes are reverted back to the style when new changes are applied!
#     # mainWidget.setStyleSheet(qdarkstyle.load_stylesheet())

#     # layout
#     layoutManager = slicer.qMRMLLayoutWidget()
#     layoutManager.setMRMLScene(slicer.mrmlScene)




#     # layoutManager.setLayout(slicer.vtkMRMLLayoutNode.SlicerLayoutOneUpRedSliceView) # slicer.vtkMRMLLayoutNode.SlicerLayoutOneUp3DView




#     splitter.addWidget(layoutManager)

#     # mainWidget.setStyleSheet(qdarkstyle.load_stylesheet(palette=qdarkstyle.light.palette.LightPalette))
#     # slicer.util.forceRenderAllViews()


#     # hahaha, it turns out this layoutManager qSlicerLayoutManager isn't the same layout Manager above (qMRMLLayoutWidget(0x14c88aea0c0) )
#     # hahaha, ---no main window destory slicer.app.layoutManager()
#     # viewNode = slicer.app.layoutManager().threeDWidget(0).mrmlViewNode()
#     viewNode = slicer.mrmlScene.GetFirstNodeByClass("vtkMRMLViewNode")
#     # # black
#     viewNode.SetBackgroundColor(0,0,0)
#     viewNode.SetBackgroundColor2(0,0,0)

#     return mainWidget


def set_intersection_lines():

    print('***************************')
    print('loading custom screw placement module')
    print('switching on intersecting lines')

    sliceDisplayNodes = slicer.util.getNodesByClass("vtkMRMLSliceDisplayNode")
    for sliceDisplayNode in sliceDisplayNodes:
        sliceDisplayNode.SetIntersectingSlicesVisibility(1)
        sliceDisplayNode.IntersectingSlicesInteractiveOn()
        # sliceDisplayNode.SetSliceIntersectionThickness(3)


    # Center and fit displayed content in 3D view
    layoutManager = slicer.app.layoutManager()
    threeDWidget = layoutManager.threeDWidget(0)
    threeDView = threeDWidget.threeDView()
    threeDView.rotateToViewAxis(3)  # look from anterior direction
    threeDView.resetFocalPoint()  # reset the 3D view cube size and center it
    threeDView.resetCamera()  # reset camera zoom

    # Workaround to force visual update (see https://github.com/Slicer/Slicer/issues/6338)
    sliceNodes = slicer.util.getNodesByClass('vtkMRMLSliceNode')
    for sliceNode in sliceNodes:
        sliceNode.Modified()


#########################################

################### deploy on desktop #########################3

def check_rst():
    print('checking local robotic software temp folder and file')
    rstfolder = r"C:\slicer_data"
    rstfile = "currentMhdPath.txt"
    if os.path.exists(rstfolder):
        path = os.path.join(rstfolder, rstfile)
        if os.path.exists(path):
            with open(path, 'r') as txt:
                line = txt.readlines()
                print(f"load volume from {line[0]}")
                loadedVolumeNode = slicer.util.loadVolume(line[0])
                return loadedVolumeNode

        else:
            print(f"missing {path}")
            return None

    else:
        print(f'missing {rstfolder}')
        return None



####################################################################################

# mainWidget = draw_GUI()
# mainWidget.show() # must show in the main thread


# keep a record of the definition of red, yellow and green planes
sliceNode = slicer.mrmlScene.GetNodeByID("vtkMRMLSliceNodeRed")
temp = vtk.vtkMatrix3x3()
sliceNode.GetAxialSliceToRASMatrix(temp)
AXIAL = np.array(temp.GetData()).reshape(3, 3)

temp = vtk.vtkMatrix3x3()
sliceNode.GetCoronalSliceToRASMatrix(temp)
CORONAL = np.array(temp.GetData()).reshape(3, 3)

temp = vtk.vtkMatrix3x3()
sliceNode.GetSagittalSliceToRASMatrix(temp)
SAGITTAL = np.array(temp.GetData()).reshape(3, 3)


new_dir = r"C:\Users\hp\tableTop\mvisioner\3dslicer_sampleData\ChestCT"


mhd_path = os.path.join(new_dir, "301 No series description.mhd")


print (f'load volume from ', mhd_path)
loadedVolumeNode = slicer.util.loadVolume(mhd_path)
slicer.util.setSliceViewerLayers(loadedVolumeNode, fit=True)
# volRenLogic = slicer.modules.volumerendering.logic()
# displayNode = volRenLogic.CreateDefaultVolumeRenderingNodes(loadedVolumeNode)
# displayNode.SetVisibility(True)
# preset="CT-AAA"
# displayNode.GetVolumePropertyNode().Copy(volRenLogic.GetPresetByName(preset))

ijkToRas = grab_ijkToRas(loadedVolumeNode)
print('ijkToRas')
print(ijkToRas)



styleNode = create_style_tables()

resultTableNode = create_parameter_table()

# link to my own python object
try:


    # # ####################### custom module and path
    slicer.util.selectModule("addScrew")
    slicer.modules.addScrewWidget.pointer2SCREWMODELS = SCREWMODELS

    ################### load screw models
    SCREW_MODEL_FOLDER = slicer.modules.addScrewWidget.resourcePath("20250415_U-Peidcle Screw_7300_T10")
    cap = "7300-T10_Top.obj"
    # thread = "7300-T106540.obj"
    SCREWMODELPREFIX = "7300-T10"

except Exception as e:
    print(e)
    print('is our screw insertion module working?')

####################################

resultTableNode.AddObserver(vtk.vtkCommand.ModifiedEvent, UpdateScrewStyle)

draw_layout()
set_intersection_lines()


if TURN_ON_SEG:
    maskFile = os.path.join(r"D:\storage\nfyy\training\derivatives", PATIENT_ID, PATIENT_ID + "_seg-vert_msk.nii.gz")
    print('load mask from ', maskFile)
    segNode = slicer.util.loadSegmentation(maskFile)
    segContainer = SegContainer()
else:
    segContainer = None





# # only for sanity check, we should check the actual segmentation inside Slicer
# f = os.path.join(r"D:\storage\nfyy\derivatives", PATIENT_ID, PATIENT_ID + "_seg-subreg_ctd.json")
# d = read_json_file(f)




# draw_wings_on_slicingPlane()
draw_cone_on_slicingPlane()
# hide_panels()




if TURN_ON_SEG:

    # initialization
    IdNamePairs = snapshot(segNode)
    """
    To rename a segment, we use Slicer gui to rename or delete the segment inside segmentation
    1) take a snapshot so that we know whose name has been changed
    2) work out the correct name for the first segment based on the new name of one single segment
    3) reorder and rename all segments in proper order
    4) update snapshot
    """

    """
    Vertebrae id <---> name

    segmentation id <-----> name* (we update segment names)

    bridge vertebrae to segmentation through name*

    IdNamePairs
    OrderedDict([('Segment_20', 'Segment_2'), ('Segment_21', 'Segment_3'), ('Segment_22', 'Segment_4'), ('Segment_23', 'Segment_5'), ('Segment_24', 'Segment_6')])

    VERTLABELTOID
    {'C1': 1, 'C2': 2, 'C3': 3, 'C4': 4, 'C5': 5, 'C6': 6, 'C7': 7, 'T1': 8, 'T2': 9, 'T3': 10, 'T4': 11, 'T5': 12, 'T6': 13, 'T7': 14, 'T8': 15, 'T9': 16, 'T10': 17, 'T11': 18, 'T12': 19, 'L1': 20, 'L2': 21, 'L3': 22, 'L4': 23, 'L5': 24, 'S1': 25}


    """
else:
    IdNamePairs = None

def refresh():
    global IdNamePairs, segNode
    IdNamePairs = update_all_segments(IdNamePairs, segNode, ALLOW_T13, ALLOW_L6, DISALLOW_T12)


def save():
    write_colorNode(segNode, source_dir)


# se = sliceNode.GetSliceToRAS()
# se =  slicer.util.arrayFromVTKMatrix(se)
# print(se)



# https://slicer.readthedocs.io/en/latest/developer_guide/script_repository.html
viewNode = slicer.app.layoutManager().threeDWidget(0).mrmlViewNode()
viewNode.SetBackgroundColor(0,0,0)
viewNode.SetBackgroundColor2(0,0,0)
view=slicer.app.layoutManager().threeDWidget(0)
view.controllerWidget().pinButton().hide()
view.controllerWidget().viewLabel().hide()
view.controllerWidget().showMaximizeViewButton = False
# view.controllerWidget().setHidden(True)
"""
the layout and size is determined by the bar widget.
So if we hide the bar widget. Slicer can't calculate the right proportion.
Instead, we need to hide all buttons under the widget but keep the widget itself.
Finally set the color to be the same as the background  / black
"""
# view.controllerWidget().barWidget().hide()

a = view.controllerWidget().barWidget()
b = qt.QLabel() # placeholder for Horizontal layout
a.layout().addWidget(b)
view.controllerWidget().barWidget().children()[-2].hide()
view.controllerWidget().setStyleSheet("background-color: #000000;")


for color in ["Red", "Yellow", "Green"]:
    sliceController = slicer.app.layoutManager().sliceWidget(color).sliceController()
    # hide what is not needed
    sliceController.pinButton().hide()
    sliceController.viewLabel().hide()
    sliceController.fitToWindowToolButton().hide()
    # sliceController.sliceOffsetSlider().hide()
    sliceController.sliceOffsetSlider().spinBoxVisible = False
    sliceController.setShowMaximizeViewButton(False)

    if color == "Red":
        sliceController.setStyleSheet("background-color: #8B0000;")
    elif color == "Yellow":
        sliceController.setStyleSheet("background-color: #666600;")
    elif color == "Green":
        sliceController.setStyleSheet("background-color: #008000;")
    else:
        raise RuntimeError(f"color {color} is invalid!")
