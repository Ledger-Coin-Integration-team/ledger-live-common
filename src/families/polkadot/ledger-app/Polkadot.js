/** ******************************************************************************
 *  (c) 2019 ZondaX GmbH
 *  (c) 2016-2017 Ledger
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */

import BIPPath from "bip32-path";

const CHUNK_SIZE = 250;

const PAYLOAD_TYPE = {
  INIT: 0x00,
  ADD: 0x01,
  LAST: 0x02,
};

const P1_VALUES = {
  ONLY_RETRIEVE: 0x00,
  SHOW_ADDRESS_IN_DEVICE: 0x01,
};

const ERROR_CODE = {
  NoError: 0x9000,
};

const ERROR_DESCRIPTION = {
  1: "U2F: Unknown",
  2: "U2F: Bad request",
  3: "U2F: Configuration unsupported",
  4: "U2F: Device Ineligible",
  5: "U2F: Timeout",
  14: "Timeout",
  0x9000: "No errors",
  0x9001: "Device is busy",
  0x6802: "Error deriving keys",
  0x6400: "Execution Error",
  0x6700: "Wrong Length",
  0x6982: "Empty Buffer",
  0x6983: "Output buffer too small",
  0x6984: "Data is invalid",
  0x6985: "Conditions not satisfied",
  0x6986: "Transaction rejected",
  0x6a80: "Bad key handle",
  0x6b00: "Invalid P1/P2",
  0x6d00: "Instruction not supported",
  0x6e00: "App does not seem to be open",
  0x6f00: "Unknown error",
  0x6f01: "Sign/verify error",
};

const CLA = {
  KUSAMA: 0x99,
  POLKADOT: 0x90,
};

// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const SLIP0044 = {
  KUSAMA: 0x800001b2,
  POLKADOT: 0x80000162,
};

const INS = {
  GET_VERSION: 0x00,
  GET_ADDR_ED25519: 0x01,
  SIGN_ED25519: 0x02,

  // Allow list related commands
  ALLOWLIST_GET_PUBKEY: 0x90,
  ALLOWLIST_SET_PUBKEY: 0x91,
  ALLOWLIST_GET_HASH: 0x92,
  ALLOWLIST_UPLOAD: 0x93,
};

function errorCodeToString(statusCode) {
  if (statusCode in ERROR_DESCRIPTION) return ERROR_DESCRIPTION[statusCode];
  return `Unknown Status Code: ${statusCode}`;
}

function isDict(v) {
  return (
    typeof v === "object" &&
    v !== null &&
    !(v instanceof Array) &&
    !(v instanceof Date)
  );
}

function processErrorResponse(response) {
  if (response) {
    if (isDict(response)) {
      if (Object.prototype.hasOwnProperty.call(response, "statusCode")) {
        return {
          return_code: response.statusCode,
          error_message: errorCodeToString(response.statusCode),
        };
      }

      if (
        Object.prototype.hasOwnProperty.call(response, "return_code") &&
        Object.prototype.hasOwnProperty.call(response, "error_message")
      ) {
        return response;
      }
    }
    return {
      return_code: 0xffff,
      error_message: response.toString(),
    };
  }

  return {
    return_code: 0xffff,
    error_message: response.toString(),
  };
}

async function getVersion(transport, cla) {
  return transport.send(cla, INS.GET_VERSION, 0, 0).then((response) => {
    const errorCodeData = response.slice(-2);
    const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

    // 12 bytes + 2 error code
    if (response.length !== 14) {
      return {
        return_code: 0x6984,
        error_message: errorCodeToString(0x6984),
      };
    }

    const major = response[1] * 256 + response[2];
    const minor = response[3] * 256 + response[4];
    const patch = response[5] * 256 + response[6];
    const deviceLocked = response[7] === 1;
    // eslint-disable-next-line no-bitwise
    const targetId =
      (response[8] << 24) +
      (response[9] << 16) +
      (response[10] << 8) +
      (response[11] << 0);

    return {
      return_code: returnCode,
      error_message: errorCodeToString(returnCode),
      // ///
      test_mode: response[0] !== 0,
      major,
      minor,
      patch,
      deviceLocked,
      target_id: targetId.toString(16),
    };
  }, processErrorResponse);
}

class SubstrateApp {
  constructor(cla, transport) {
    if (!transport) {
      throw new Error("Transport has not been defined");
    }

    this.transport = transport;
    this.cla = cla;
  }

  static serializePath(path) {
    const bipPath = BIPPath.fromString(path).toPathArray();

    const buf = Buffer.alloc(20);
    buf.writeUInt32LE(bipPath[0], 0);
    buf.writeUInt32LE(bipPath[1], 4);
    buf.writeUInt32LE(bipPath[2], 8);
    buf.writeUInt32LE(bipPath[3], 12);
    buf.writeUInt32LE(bipPath[4], 16);

    return buf;
  }
  
  static GetChunks(message) {
    const chunks = [];
    const buffer = Buffer.from(message);

    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      let end = i + CHUNK_SIZE;
      if (i > buffer.length) {
        end = buffer.length;
      }
      chunks.push(buffer.slice(i, end));
    }

    return chunks;
  }

  static signGetChunks(path, message) {
    const chunks = [];
    const bip44Path = SubstrateApp.serializePath(path);
    chunks.push(bip44Path);
    chunks.push(...SubstrateApp.GetChunks(message));
    return chunks;
  }

  async getVersion() {
    try {
      return await getVersion(this.transport, this.cla);
    } catch (e) {
      return processErrorResponse(e);
    }
  }

  async appInfo() {
    return this.transport.send(0xb0, 0x01, 0, 0).then((response) => {
      const errorCodeData = response.slice(-2);
      const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

      const result = {};

      let appName = "err";
      let appVersion = "err";
      let flagLen = 0;
      let flagsValue = 0;

      if (response[0] !== 1) {
        // Ledger responds with format ID 1. There is no spec for any format != 1
        result.error_message = "response format ID not recognized";
        result.return_code = 0x9001;
      } else {
        const appNameLen = response[1];
        appName = response.slice(2, 2 + appNameLen).toString("ascii");
        let idx = 2 + appNameLen;
        const appVersionLen = response[idx];
        idx += 1;
        appVersion = response.slice(idx, idx + appVersionLen).toString("ascii");
        idx += appVersionLen;
        const appFlagsLen = response[idx];
        idx += 1;
        flagLen = appFlagsLen;
        flagsValue = response[idx];
      }

      return {
        return_code: returnCode,
        error_message: errorCodeToString(returnCode),
        // //
        appName,
        appVersion,
        flagLen,
        flagsValue,
        // eslint-disable-next-line no-bitwise
        flag_recovery: (flagsValue & 1) !== 0,
        // eslint-disable-next-line no-bitwise
        flag_signed_mcu_code: (flagsValue & 2) !== 0,
        // eslint-disable-next-line no-bitwise
        flag_onboarded: (flagsValue & 4) !== 0,
        // eslint-disable-next-line no-bitwise
        flag_pin_validated: (flagsValue & 128) !== 0,
      };
    }, processErrorResponse);
  }

  async getAddress(path, requireConfirmation = false) {
    const bip44Path = SubstrateApp.serializePath(path);

    console.log('bip44', bip44Path);

    let p1 = 0;
    if (requireConfirmation) p1 = 1;

    return this.transport
      .send(this.cla, INS.GET_ADDR_ED25519, p1, 0, bip44Path)
      .then((response) => {
        const errorCodeData = response.slice(-2);
        const errorCode = errorCodeData[0] * 256 + errorCodeData[1];

        return {
          pubKey: response.slice(0, 32).toString("hex"),
          address: response.slice(32, response.length - 2).toString("ascii"),
          return_code: errorCode,
          error_message: errorCodeToString(errorCode),
        };
      }, processErrorResponse);
  }

  async signSendChunk(chunkIdx, chunkNum, chunk) {
    let payloadType = PAYLOAD_TYPE.ADD;
    if (chunkIdx === 1) {
      payloadType = PAYLOAD_TYPE.INIT;
    }
    if (chunkIdx === chunkNum) {
      payloadType = PAYLOAD_TYPE.LAST;
    }

    return this.transport
      .send(this.cla, INS.SIGN_ED25519, payloadType, 0, chunk, [
        ERROR_CODE.NoError,
        0x6984,
        0x6a80,
      ])
      .then((response) => {
        const errorCodeData = response.slice(-2);
        const returnCode = errorCodeData[0] * 256 + errorCodeData[1];
        let errorMessage = errorCodeToString(returnCode);
        let signature = null;

        if (returnCode === 0x6a80 || returnCode === 0x6984) {
          errorMessage = response
            .slice(0, response.length - 2)
            .toString("ascii");
        } else if (response.length > 2) {
          signature = response.slice(0, response.length - 2);
        }

        return {
          signature,
          return_code: returnCode,
          error_message: errorMessage,
        };
      }, processErrorResponse);
  }

  async sign(path, message) {
    const chunks = SubstrateApp.signGetChunks(path, message);

    return this.signSendChunk(1, chunks.length, chunks[0]).then(
      async (result) => {
        for (let i = 1; i < chunks.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop,no-param-reassign
          result = await this.signSendChunk(1 + i, chunks.length, chunks[i]);
          if (result.return_code !== ERROR_CODE.NoError) {
            break;
          }
        }

        return {
          return_code: result.return_code,
          error_message: result.error_message,
          signature: result.signature,
        };
      },
      processErrorResponse
    );
  }

  /// Allow list related commands. They are NOT available on all apps

  async getAllowlistPubKey() {
    return this.transport
      .send(this.cla, INS.ALLOWLIST_GET_PUBKEY, 0, 0)
      .then((response) => {
        const errorCodeData = response.slice(-2);
        const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

        console.log(response);

        const pubkey = response.slice(0, 32);
        // 32 bytes + 2 error code
        if (response.length !== 34) {
          return {
            return_code: 0x6984,
            error_message: errorCodeToString(0x6984),
          };
        }

        return {
          return_code: returnCode,
          error_message: errorCodeToString(returnCode),
          pubkey,
        };
      }, processErrorResponse);
  }

  async setAllowlistPubKey(pk) {
    return this.transport
      .send(this.cla, INS.ALLOWLIST_SET_PUBKEY, 0, 0, pk)
      .then((response) => {
        const errorCodeData = response.slice(-2);
        const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

        return {
          return_code: returnCode,
          error_message: errorCodeToString(returnCode),
        };
      }, processErrorResponse);
  }

  async getAllowlistHash() {
    return this.transport
      .send(this.cla, INS.ALLOWLIST_GET_HASH, 0, 0)
      .then((response) => {
        const errorCodeData = response.slice(-2);
        const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

        console.log(response);

        const hash = response.slice(0, 32);
        // 32 bytes + 2 error code
        if (response.length !== 34) {
          return {
            return_code: 0x6984,
            error_message: errorCodeToString(0x6984),
          };
        }

        return {
          return_code: returnCode,
          error_message: errorCodeToString(returnCode),
          hash,
        };
      }, processErrorResponse);
  }

  async uploadSendChunk(chunkIdx, chunkNum, chunk) {
    let payloadType = PAYLOAD_TYPE.ADD;
    if (chunkIdx === 1) {
      payloadType = PAYLOAD_TYPE.INIT;
    }
    if (chunkIdx === chunkNum) {
      payloadType = PAYLOAD_TYPE.LAST;
    }

    return this.transport
      .send(this.cla, INS.ALLOWLIST_UPLOAD, payloadType, 0, chunk, [
        ERROR_CODE.NoError,
      ])
      .then((response) => {
        const errorCodeData = response.slice(-2);
        const returnCode = errorCodeData[0] * 256 + errorCodeData[1];
        let errorMessage = errorCodeToString(returnCode);

        return {
          return_code: returnCode,
          error_message: errorMessage,
        };
      }, processErrorResponse);
  }

  async uploadAllowlist(message) {
    const chunks = [];
    chunks.push(Buffer.from([0]));
    chunks.push(...SubstrateApp.GetChunks(message));

    return this.uploadSendChunk(1, chunks.length, chunks[0]).then(
      async (result) => {
        if (result.return_code !== ERROR_CODE.NoError) {
          return {
            return_code: result.return_code,
            error_message: result.error_message,
          };
        }

        for (let i = 1; i < chunks.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop,no-param-reassign
          result = await this.uploadSendChunk(1 + i, chunks.length, chunks[i]);
          if (result.return_code !== ERROR_CODE.NoError) {
            break;
          }
        }

        return {
          return_code: result.return_code,
          error_message: result.error_message,
        };
      },
      processErrorResponse
    );
  }
}

export const Polkadot = SubstrateApp.bind(null, CLA.POLKADOT);
export const Kusama = SubstrateApp.bind(null, CLA.KUSAMA);