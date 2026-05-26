"use strict";
// Entry point for the Node v4 programming model. Azure Functions host loads
// this file (per package.json "main"), which registers all functions via
// side-effect imports.
Object.defineProperty(exports, "__esModule", { value: true });
require("./functions/caseHttpStart");
require("./functions/caseStatus");
require("./functions/caseOrchestrator");
require("./activities/historian");
require("./activities/differential");
require("./activities/evidence");
require("./activities/devilsAdvocate");
require("./activities/synthesizer");
//# sourceMappingURL=index.js.map