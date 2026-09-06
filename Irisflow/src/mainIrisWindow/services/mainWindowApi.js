export async function fetchChats() {
  return window.iris.getChats();
}

export async function fetchResources() {
  return window.iris.getResources();
}

async function fileToPayload(file) {
  const buffer = await file.arrayBuffer();
  return {
    name: file.name,
    type: file.type,
    bytes: new Uint8Array(buffer),
  };
}

export async function uploadResources(files) {
  const payloads = await Promise.all(Array.from(files).map(fileToPayload));
  return window.iris.uploadResources(payloads);
}

export async function setResourceIncluded(resourceId, included) {
  return window.iris.setResourceIncluded(resourceId, included);
}

export async function deleteResource(resourceId) {
  return window.iris.deleteResource(resourceId);
}
