//@flow
import type Transport from "@ledgerhq/hw-transport";
import md5 from "crypto-js/md5";
import { UserRefusedOnDevice, UserRefusedAddress } from "@ledgerhq/errors";

const APP_KEY = "MYC";
const RNG_GET_ADDR = 0.1;
const RNG_GET_SIGN = 0.2;

const SW_OK = 0x9000;

const rng = (threshold) => Math.random() < threshold;

/**
 * MyCoin Fake API
 */
export default class MyCoin {
  transport: Transport<*>;

  constructor(transport: Transport<*>, scrambleKey: string = APP_KEY) {
    this.transport = transport;
    transport.decorateAppAPIMethods(
      this,
      ["getAddress", "signTransaction", "getAppConfiguration"],
      scrambleKey
    );
  }

  async getAddress(
    path: string,
    display?: boolean
  ): Promise<{
    publicKey: string,
    address: string,
    returnCode: number,
  }> {
    await this.transport.send(0, 0, 0, 0).catch(() => {});

    if (display && rng(RNG_GET_ADDR)) {
      throw new UserRefusedAddress();
    }

    return {
      publicKey: md5(path).toString(),
      address: md5(path).toString(),
      returnCode: SW_OK,
    };
  }

  signTransaction(
    path: string,
    message: string
  ): Promise<{ signature: null | Buffer, returnCode: number }> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (rng(RNG_GET_SIGN)) {
          reject(new UserRefusedOnDevice());
        } else {
          const addr = md5(path).toString();
          resolve({
            signature: md5(`${addr}:${message}`).toString(),
            returnCode: SW_OK,
          });
        }
      }, 3000);
    });
  }
}
