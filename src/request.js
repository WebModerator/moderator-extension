const MODERATECONTENT_COM_FREE_API = "moderatecontent.com-free"
const PRIMUS_URL = "http://localhost:18080"

const primus = Primus.connect(PRIMUS_URL)

// uuidV4 function from https://stackoverflow.com/a/2117523
function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

class DataStreamPromisifier {
  constructor() {
    this.pending = {}
  }

  getPromise(id) {
    return new Promise((resolve, reject) => {
      this.pending[id] = data => data.error ? reject(data.error) : resolve(data.responses)
    })
  }

  pushData(id, data) {
    if (typeof this.pending[id] !== "function") {
      console.log("nothing to do for " + id)
      return
    }
    this.pending[id](data)
    delete this.pending[id]
  }
}

const dataStreamPromisifier = new DataStreamPromisifier()
const uuidv4Regex = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i

primus.on("data", data => {
  if (!uuidv4Regex.test(data.requestId)) return
  dataStreamPromisifier.pushData(data.requestId, data)
});

const callRemoteFunction = async (type, payload) => {
  let requestId = uuidv4()
  let dataPromise = dataStreamPromisifier.getPromise(requestId)
  primus.write({
    requestId: requestId,
    type: type,
    payload: payload
  });
  return await dataPromise
}

const callback = async (details) => {
  try {
    const responses = callRemoteFunction("datarequest", {services: [MODERATECONTENT_COM_FREE_API], data: encodeURIComponent(details.url)})
    //cancel based on responses
    return {
      cancel: cancel
    }
  } catch (e) {
    console.log(e)
    return {
      cancel: false
    }
  }
};

const filter = {
  urls: ["*://*/*"],
  types: [
    "image"
  ]
}

const opt_extraInfoSpec = ['blocking']

chrome.webRequest.onBeforeRequest.addListener(callback, filter, opt_extraInfoSpec)

