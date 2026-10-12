# ConX-Viewer
A 3D **web viewer for IFC** files, developed as part of the **Construct-X** project. See [Construct-X](https://www.construct-x.org) for more information about the project.

Its goal is to enable the inspection of **Digital Product Passports (DPP)** and **CO₂** equivalents for construction/building related products if the data is embedded and linked to an object within the IFC file. 
It is recommended to use a URL as DPP content in order to link a Digital Product Passport.

## IFC Property Compatibility

The viewer reads Digital Product Passport and CO₂ emission values embedded in the selected object's IFC property sets, matching properties by name.
Properties are recognized by name: `DigitalPassport`, `DigitalProductPass`, `DigitalProductPassport`, `DigitalProductPassportURL`, or `DPP` for passport data, and any property name containing `CO2Emission` for emissions. Matching is case-insensitive and ignores punctuation. This lets the viewer read IFC files that use these property names.

## Quickstart

Fast way to use the viewer:
  
1. Clone or download and unzip the project
```bash
https://github.com/HottgenrothGit/conx-viewer.git
```
3. Install yarn globally (if necessary)
```bash
npm i -g yarn
```
5. Navigate in terminal to the project folder and execute
```bash
npm run init-repo
```
7. Run Build  
```bash
npm run build
```
9. Start the web app in default Browser
```bash
npm run start-open
```
11. Click on the **Load** button and select an IFC file
12. Double-click a 3D object to select it → an info box will show available DPP data

---
### License

MIT License

---

### Acknowledgements

Based on the project [web-ifc-three](https://github.com/ThatOpen/web-ifc-three)

---
