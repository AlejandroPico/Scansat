import * as THREE from 'three';
export function physicalShader(options) {
  options.vertexShader = '#include <common>\n#include <logdepthbuf_pars_vertex>\n' + options.vertexShader;
  const end = options.vertexShader.lastIndexOf('}');
  options.vertexShader = options.vertexShader.slice(0,end) + '\n#include <logdepthbuf_vertex>\n' + options.vertexShader.slice(end);
  options.fragmentShader = '#include <logdepthbuf_pars_fragment>\n' + options.fragmentShader;
  options.fragmentShader = options.fragmentShader.replace(/void main\(\)\s*\{/, 'void main(){\n#include <logdepthbuf_fragment>\n');
  return new THREE.ShaderMaterial(options);
}

