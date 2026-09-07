export const MIST_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/** Two advected density fields, lit from the hall window. No ray marching. */
export const MIST_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_noise;
uniform float u_time;
uniform float u_aspect;
varying vec2 v_uv;

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return texture2D(u_noise, (cell + f + 0.5) / 128.0).r;
}

float fbm(vec2 p) {
  float n = noise(p) * 0.53;
  p = mat2(1.91, 0.42, -0.42, 1.91) * p + 13.7;
  n += noise(p) * 0.27;
  p = mat2(1.83, -0.56, 0.56, 1.83) * p + 9.2;
  n += noise(p) * 0.13;
  return n + noise(p * 2.03 + 4.8) * 0.07;
}

void main() {
  vec2 uv = v_uv;
  float t = u_time;
  vec2 p = vec2(uv.x * u_aspect, uv.y) * 2.3;

  // Large eddies carry finer folds. Different drift speeds avoid a sliding sheet.
  vec2 eddy = vec2(
    noise(p * 0.7 + vec2(-t * 0.025, t * 0.009)),
    noise(p * 0.65 + vec2(t * 0.017, -t * 0.013) + 37.0)
  ) - 0.5;
  float farField = fbm(p * vec2(1.0, 2.6) + eddy * 1.4 + vec2(t * 0.026, -t * 0.012));
  float nearField = fbm(p * vec2(1.5, 4.1) - eddy * 1.8 + vec2(-t * 0.047, t * 0.018) + 19.0);

  // Thin high haze, denser rolling mist near the floor; upper readouts stay clear.
  float lowBank = 1.0 - smoothstep(0.08, 0.61, uv.y);
  float highVeil = smoothstep(0.04, 0.32, uv.y) * (1.0 - smoothstep(0.4, 0.9, uv.y));
  float density = smoothstep(0.3, 0.76, farField) * (lowBank * 0.32 + highVeil * 0.16);
  density += smoothstep(0.4, 0.8, nearField) * lowBank * 0.29;

  float edge = smoothstep(0.0, 0.06, uv.x) * (1.0 - smoothstep(0.94, 1.0, uv.x));
  edge *= smoothstep(0.0, 0.07, uv.y) * (1.0 - smoothstep(0.8, 1.0, uv.y));
  float windowLight = exp(-pow((uv.x - 0.52) * 2.8, 2.0));
  vec3 color = mix(vec3(0.26, 0.31, 0.32), vec3(0.57, 0.64, 0.65), windowLight * 0.72 + nearField * 0.16);
  float alpha = min(density * edge, 0.4);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;
