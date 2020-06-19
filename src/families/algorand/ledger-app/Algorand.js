/********************************************************************************
 *   Ledger Node JS API
 *   (c) 2017-2018 Ledger
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
 ********************************************************************************/
//@flow

import type Transport from "@ledgerhq/hw-transport";
import BIPPath from "bip32-path";
import { UserRefusedOnDevice } from "@ledgerhq/errors";
const CHUNK_SIZE = 250;
const INS_GET_VERSION = 0x00;
const INS_SIGN_SECP256K1 = 0x02;
const INS_GET_ADDR_SECP256K1 = 0x04;

const PAYLOAD_TYPE_INIT = 0x00;
const PAYLOAD_TYPE_ADD = 0x01;
const PAYLOAD_TYPE_LAST = 0x02;

const SW_OK = 0x9000;
const SW_CANCEL = 0x6986;

// algo spec
const CLA = 0x80;
const INS_GET_PUBLIC_KEY = 0x03;

/**
 * Cosmos API
 *
 * @example
 * import Cosmos from "@ledgerhq/hw-app-cosmos";
 * const cosmos = new Cosmos(transport)
 */
export default class Algorand {
  transport: Transport<*>;

  constructor(transport: Transport<*>) {
    this.transport = transport;
    transport.decorateAppAPIMethods(
      this,
      ["getAddress", "sign", "getAppConfiguration"],
      "ALGO"
    );
  }

  getAppConfiguration() {
    return this.transport.send(CLA, INS_GET_VERSION, 0, 0).then((response) => {
      console.log(response);
      return {
        test_mode: response[0] !== 0,
        version: "" + response[1] + "." + response[2] + "." + response[3],
        device_locked: response[4] === 1,
        major: response[1],
      };
    });
  }

  /**
   * get Cosmos address for a given BIP 32 path.
   * @param path a path in BIP 32 format
   * @param hrp usually cosmos
   * @option boolDisplay optionally enable or not the display
   * @return an object with a publicKey, address and (optionally) chainCode
   * @example
   * cosmos.getAddress("44'/60'/0'/0/0").then(o => o.address)
   */
  getAddress(
    path: string,
    boolDisplay?: boolean
  ): Promise<{ publicKey: string, address: string }> {
    const bipPath = BIPPath.fromString(path).toPathArray();

    let buffer = Buffer.alloc(1 + bipPath.length * 4);
    buffer[0] = bipPath.length;
    bipPath.forEach((element, index) => {
      buffer.writeUInt32BE(element, 1 + 4 * index);
    });

    return this.transport
      .send(CLA, INS_GET_PUBLIC_KEY, boolDisplay ? 1 : 0, 0, buffer, [SW_OK])
      .then((response) => {
        const publicKey = Buffer.from(response.slice(0, 32)).toString("hex");

        return {
          publicKey,
        };
      });
  }

  foreach<T, A>(arr: T[], callback: (T, number) => Promise<A>): Promise<A[]> {
    function iterate(index, array, result) {
      if (index >= array.length) {
        return result;
      } else
        return callback(array[index], index).then(function (res) {
          result.push(res);
          return iterate(index + 1, array, result);
        });
    }
    return Promise.resolve().then(() => iterate(0, arr, []));
  }

  async sign(
    path: string,
    message: string
  ): Promise<{ signature: null | Buffer, return_code: number }> {
    const bipPath = BIPPath.fromString(path).toPathArray();
    const serializedPath = this.serializePath(bipPath);

    const chunks = [];
    chunks.push(serializedPath);
    const buffer = Buffer.from(message);

    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      let end = i + CHUNK_SIZE;
      if (i > buffer.length) {
        end = buffer.length;
      }
      chunks.push(buffer.slice(i, end));
    }

    let response = {};

    return this.foreach(chunks, (data, j) =>
      this.transport
        .send(
          CLA,
          INS_SIGN_SECP256K1,
          j === 0
            ? PAYLOAD_TYPE_INIT
            : j + 1 === chunks.length
            ? PAYLOAD_TYPE_LAST
            : PAYLOAD_TYPE_ADD,
          0,
          data,
          [SW_OK, SW_CANCEL]
        )
        .then((apduResponse) => (response = apduResponse))
    ).then(() => {
      const errorCodeData = response.slice(-2);
      const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

      let signature = null;
      if (response.length > 2) {
        signature = response.slice(0, response.length - 2);
      }

      if (returnCode === 0x6986) {
        throw new UserRefusedOnDevice();
      }

      return {
        signature: signature,
        return_code: returnCode,
      };
    });
  }
}
