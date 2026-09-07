import { MIST_FRAGMENT_SHADER, MIST_VERTEX_SHADER } from "./enemy-mist-shader";

export interface EnemyMistRenderer {
  draw: (seconds: number) => void;
  resize: () => void;
  dispose: () => void;
}

/** Local visual noise, independent of the game's RNG and save state. */
function createNoise() {
  const bytes = new Uint8Array(128 * 128);
  let seed = 0x6d617269;
  for (let i = 0; i < bytes.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    bytes[i] = seed >>> 24;
  }
  return bytes;
}

export function createEnemyMistRenderer(canvas: HTMLCanvasElement): EnemyMistRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power"
  });
  if (!gl) return null;

  const program = gl.createProgram();
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  const dispose = () => {
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteProgram(program);
  };
  if (!program || !vertex || !fragment || !buffer || !texture) {
    dispose();
    return null;
  }
  gl.shaderSource(vertex, MIST_VERTEX_SHADER);
  gl.shaderSource(fragment, MIST_FRAGMENT_SHADER);
  gl.compileShader(vertex);
  gl.compileShader(fragment);
  if (!gl.getShaderParameter(vertex, gl.COMPILE_STATUS) || !gl.getShaderParameter(fragment, gl.COMPILE_STATUS)) {
    dispose();
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    dispose();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 128, 128, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, createNoise());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.uniform1i(gl.getUniformLocation(program, "u_noise"), 0);
  const time = gl.getUniformLocation(program, "u_time");
  const aspect = gl.getUniformLocation(program, "u_aspect");

  return {
    draw(seconds) {
      gl.uniform1f(time, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resize() {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.max(bounds.width, 1) / Math.max(bounds.height, 1);
      // Mist is soft by design: cap fill rate independently of Retina resolution.
      const width = Math.max(1, Math.min(640, Math.round(bounds.width * 0.65)));
      const height = Math.max(1, Math.round(width / ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform1f(aspect, ratio);
    },
    dispose
  };
}
