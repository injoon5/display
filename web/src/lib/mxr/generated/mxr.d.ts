type MxrModule = {
  HEAP32: Int32Array;
  HEAPU16: Uint16Array;
  HEAPU8: Uint8Array;
  _free: (ptr: number) => void;
  _malloc: (size: number) => number;
  _mxr_render: (ctxPtr: number) => number;
  _mxr_validate?: (programPtr: number, len: number, diagPtr: number) => number;
};

type MxrFactory = (config?: {
  locateFile?: (path: string, scriptDirectory: string) => string;
}) => Promise<MxrModule>;

declare const Module: MxrFactory;
export default Module;
