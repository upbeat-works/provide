import { processMapRequests } from '../maps/impact-geo-grid.js';

self.onmessage = ({ data }) => processMapRequests(data, (result) => self.postMessage(result));
