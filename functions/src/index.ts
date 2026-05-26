// Entry point for the Node v4 programming model. Azure Functions host loads
// this file (per package.json "main"), which registers all functions via
// side-effect imports.

import './functions/caseHttpStart';
import './functions/caseStatus';
import './functions/caseOrchestrator';
import './activities/historian';
import './activities/differential';
import './activities/evidence';
import './activities/devilsAdvocate';
import './activities/synthesizer';
