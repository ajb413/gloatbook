async function postRequest(url = '', data = '') {
  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: data // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

async function getUsersZoraNfts(addr = '') {
  const response = await fetch("https://api.thegraph.com/subgraphs/name/ourzora/zora-v1", {
    "headers": {
      "content-type": "application/json",
    },
    "body": "{\"query\":\"{\\n  users(where:{ id: \\\"" + addr + "\\\" }) {\\n    id\\n    creations {\\n      id\\n    }\\n    collection { id }\\n  }}\",\"variables\":null}",
    "method": "POST",
  });
  return response.json();
}

async function getZoraNftMetadata(id = '') {
  const response = await fetch("https://api.thegraph.com/subgraphs/name/ourzora/zora-v1", {
    "headers": {
      "content-type": "application/json",
    },
    "body": "{\"query\":\"\\n{\\n  media(id: \\\"" +id+ "\\\" ) {\\n    id\\n    owner { id }\\n    creator { id }\\n    metadataURI\\n    contentURI\\n  }\\n}\",\"variables\":null}",
    "method": "POST",
  });
  return response.json();
}

async function getEnsDomainWithAddress(addr = '') {
  const response = await fetch("https://api.thegraph.com/subgraphs/name/ensdomains/ens", {
    "headers": {
      "content-type": "application/json",
    },
    "body": "{\"operationName\":\"getRegistrations\",\"variables\":{\"id\":\"" + addr + "\",\"first\":30,\"skip\":0,\"orderBy\":\"expiryDate\",\"orderDirection\":\"asc\",\"expiryDate\":1608526662},\"query\":\"query getRegistrations($id: ID!, $first: Int, $skip: Int, $orderBy: Registration_orderBy, $orderDirection: OrderDirection, $expiryDate: Int) {\\n  account(id: $id) {\\n    registrations(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection, where: {expiryDate_gt: $expiryDate}) {\\n      expiryDate\\n      domain {\\n        labelName\\n        labelhash\\n        name\\n        isMigrated\\n        parent {\\n          name\\n          __typename\\n        }\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}\\n\"}",
    "method": "POST",
  });
  return response.json();
}

async function fetchMetadata(url = '') {
  const response = await fetch(url);
  return response.json();
}

window.addEventListener('load', async function () {
  let urlParams;

  try {
    urlParams = JSON.parse('{"' + decodeURI(location.search.substring(1).replace(/&/g, "\",\"").replace(/=/g, "\":\"")) + '"}');
  } catch(e) {
    urlParams = {};
  }

  let isEns;
  let myAddress;
  if (
    urlParams.address &&
    typeof urlParams.address === 'string' &&
    urlParams.address.length === 42 &&
    urlParams.address.indexOf('0x') === 0
  ) {
    isEns = false;
    myAddress = urlParams.address;
  } else {
    isEns = true; // doesnt do anyhting right now
  }

  // set up etherscan link page
  const ethsc = document.getElementById('etherscan-button-anchor');
  ethsc.href = "https://etherscan.io/address/" + myAddress;
  const ethscb = document.getElementById('etherscan-button');
  ethscb.innerText = myAddress.substring(0,10) + '...';


  // const address = '0xac819d205556c1e2fab560ae7875f5e7a0f38feb';
  let idData = await getUsersZoraNfts(myAddress);
  let zoraIds = [];
  if (idData && typeof idData === 'object') {
    // console.log(data.data.users[0].creations);
    try {
      idData.data.users[0].creations.forEach((id) => {
        let newId = id.id;
        if (zoraIds.indexOf(newId) === -1) {
          zoraIds.push(newId);
        }
      });
    } catch(err) {
      console.error('error parsing zora ids for this user', err);
    }
  }
  
  const zoraNftIdFetches = [];
  zoraIds.forEach((id) => {
    zoraNftIdFetches.push(getZoraNftMetadata(id));
  });

  const zoraNftMetadatasRaw = await Promise.all(zoraNftIdFetches);

  // console.log('zoraNftMetadatasRaw', zoraNftMetadatasRaw);

  const creatorNames = [];
  const zoraNftMetadatas = [];
  zoraNftMetadatasRaw.forEach((nft) => {
    const zoraId = nft.data.media.id;
    const contentUri = nft.data.media.contentURI;
    const creator = nft.data.media.creator.id;
    const metaDataUri = nft.data.media.metadataURI;
    zoraNftMetadatas.push({ zoraId, contentUri, creator, metaDataUri });

    if (creator && !creatorNames.includes(creator)) {
      creatorNames.push(creator);
    }
  });

  // console.log('zoraNftMetadatas', zoraNftMetadatas);

  const ensLookupPromises = [];
  const jsonMetadatasPromises = [];
  zoraNftMetadatas.forEach((nft, i) => {
    jsonMetadatasPromises.push(fetchMetadata(nft.metaDataUri));
    ensLookupPromises.push(getEnsDomainWithAddress(nft.creator));
  });

  const jsonMetadatasPromisesDone = await Promise.all(jsonMetadatasPromises);
  const ensLookupPromisesDone = await Promise.all(ensLookupPromises);

  ensLookupPromisesDone.forEach((ens, i) => {
    const jsonMetadata = jsonMetadatasPromisesDone[i];
    let ensName;
    try {
      ensName = ens.data.account.registrations[0].domain.labelName;
    } catch(e) { ensName = null}
    zoraNftMetadatas[i].creatorEns = ensName;
    zoraNftMetadatas[i].metaData = jsonMetadata;
  });

  console.log('zoraNftMetadatas2', zoraNftMetadatas);

  showNftsOnPage(zoraNftMetadatas);

  // show featured artists
  const creatorList = document.getElementById('creator-list');
  let listBlob = '';
  for (var i = 0 ; i < creatorNames.length; i++) {
    console.log(creatorNames[i]);
    listBlob += `<li>${creatorNames[i]}</li>`;
  }
  creatorList.innerHTML = listBlob;
});

const nftsDisplay = document.getElementById('nfts-display');

function showNftsOnPage(nfts) {
  let htmls = '';
  nfts.forEach((nft) => {
    let artist = nft.creatorEns ? nft.creatorEns : nft.creator;
    let visualElement = nft.metaData.mimeType.includes('image') 
      ? `<img class="nft-visual" src="${nft.contentUri}" />`
      : `<video loop autoplay controls muted crossorigin="anonymous" class="nft-visual" src="${nft.contentUri}"  type="${nft.metaData.mimeType}"></video>`;
    let htmlBlob = `
      <div class="nft-item">
        ${visualElement}
        <br />
        <span class="artist-name">${artist}</span>
        <br />
        <span class="nft-name">${nft.metaData.name}</span>
        <br />
        <span class="nft-description">${nft.metaData.description}</span>
      </div>`;
    htmls += htmlBlob;
  });
  nftsDisplay.innerHTML = htmls;
  // const videos = document.getElementsByTagName('video');
  // for (var i = 0 ; i < videos.length; i++) {
  //   console.log(i);
  //   // videos[i].crossOrigin = 'anonymous';
  //   videos[i].autoplay = true;
  //   videos[i].play();
  // }
}