import { WebGLUtility, ShaderProgram } from "./lib/webgl";
import { WebGLMath } from "./lib/math";
import { WebGLOrbitCamera } from "./lib/camera";
import * as d3 from "d3";
import gsap from "gsap";

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    const app = new WebGLApp();
    window.addEventListener("resize", app.resize, false);
    app.init("webgl-canvas");
    await app.load();
    app.setup();
    app.repeatAnimation();
    app.render();
  },
  false
);

class WebGLApp {
  /**
   * @constructor
   */
  constructor() {
    // 汎用的なプロパティ
    this.canvas = null;
    this.gl = null;
    this.running = false;

    // this を固定するためメソッドをバインドする
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);

    this.centroidIteration = 0;

    // variables for voronoi stippling
    this.imageIndex = 0;
    this.imagePaths = [
      "/glsl-school-task-02/assets/takamori_saigo.png",
      "/glsl-school-task-02/assets/toshimichi_ohkubo.png",
      "/glsl-school-task-02/assets/takayoshi_kido.png",
      "/glsl-school-task-02/assets/tatewaki_komatsu.png",
      "/glsl-school-task-02/assets/masujiro_ohmura.png",
      "/glsl-school-task-02/assets/issei_maebara.png",
      "/glsl-school-task-02/assets/saneomi_hirosawa.png",
      "/glsl-school-task-02/assets/shinpei_eto.png",
      "/glsl-school-task-02/assets/yokoi_shonan.png",
      "/glsl-school-task-02/assets/tomomi_iwakura.png",
      "/glsl-school-task-02/assets/ryoma_sakamoto.png",
    ];
    this.imageNames = [
      "/glsl-school-task-02/assets/saigo_name.png",
      "/glsl-school-task-02/assets/ohkubo_name.png",
      "/glsl-school-task-02/assets/kido_name.png",
      "/glsl-school-task-02/assets/komatsu_name.png",
      "/glsl-school-task-02/assets/ohmura_name.png",
      "/glsl-school-task-02/assets/maebara_name.png",
      "/glsl-school-task-02/assets/hirosawa_name.png",
      "/glsl-school-task-02/assets/eto_name.png",
      "/glsl-school-task-02/assets/yokoi_name.png",
      "/glsl-school-task-02/assets/iwakura_name.png",
      "/glsl-school-task-02/assets/sakamoto_name.png",
    ];

    // variables for source
    this.source = document.querySelector(".source");
    this.sources = [
      "Japanese book Kinsei Meishi Shashin vol.1 (近世名士写真 其1), Published in 1934 – 1935",
      "Japanese book Kinsei Meishi Shashin vol.1 (近世名士写真 其1), Published in 1934 – 1935",
      "Japanese book Kinsei Meishi Shashin vol.1 (近世名士写真 其1), Published in 1934 – 1935",
      "Private Collection",
      "Japanese book Kinsei Meishi Shashin vol.2 (近世名士写真 其2), Published in 1934 – 1935",
      "Collections of the Northern Materials Room, Hokkaido University Library",
      "Japanese book Kinsei Meishi Shashin vol.2 (近世名士写真 其2), Published in 1934 – 1935",
      "The Japanese book '幕末・明治・大正 回顧八十年史' (Memories for 80 years, Bakumatsu, Meiji, Taisho)",
      "Japanese book Ijin Sosho vol.5 (偉人叢書. 第5)",
      "the United States Library of Congress's Prints and Photographs division",
      "Japanese book Kinsei Meishi Shashin vol.2 (近世名士写真 其2), Published in 1934 – 1935",
    ];
    this.source.innerHTML = this.sources[this.imageIndex];

    // 各種パラメータや uniform 変数用
    this.previousTime = 0; // 直前のフレームのタイムスタンプ
    this.timeScale = 1.0; // 時間の進み方に対するスケール
    this.uTime = 0.0; // uniform 変数 time 用
    this.timeObject = { value: 0 };
    this.uRatio = 0.0; // 変化の割合い
  }
  /**
   * シェーダやテクスチャ用の画像など非同期で読み込みする処理を行う。
   * @return {Promise}
   */
  async load() {
    const vs = await WebGLUtility.loadFile(
      "/glsl-school-task-02/shaders/main.vert"
    );
    const fs = await WebGLUtility.loadFile(
      "/glsl-school-task-02/shaders/main.frag"
    );
    this.shaderProgram = new ShaderProgram(this.gl, {
      vertexShaderSource: vs,
      fragmentShaderSource: fs,
      attribute: ["position1", "position2", "offset"],
      stride: [2, 2, 1],
      uniform: ["mvpMatrix", "ratio"],
      type: ["uniformMatrix4fv", "uniform1f"],
    });

    const nameVS = await WebGLUtility.loadFile(
      "/glsl-school-task-02/shaders/name.vert"
    );
    const nameFS = await WebGLUtility.loadFile(
      "/glsl-school-task-02/shaders/name.frag"
    );
    this.nameShaderProgram = new ShaderProgram(this.gl, {
      vertexShaderSource: nameVS,
      fragmentShaderSource: nameFS,
      attribute: ["vPosition", "vTexCoord", "nameOffset"],
      stride: [2, 2, 1],
      uniform: ["mvpMatrix", "ratio", "textureUnit0", "textureUnit1"],
      type: ["uniformMatrix4fv", "uniform1f", "uniform1i", "uniform1i"],
    });

    // loaders
    const loadingBarElement = document.querySelector(".loading-bar");
    let loadedItemCount = 0;
    let progressRatio = 0;
    let currentProgress = 0;

    const updateLoadingBar = () => {
      if (currentProgress < progressRatio) {
        currentProgress += 0.01; // Adjust the increment for smoother animation
        loadingBarElement.style.transform = `translateX(-50%) scaleX(${currentProgress})`;
        requestAnimationFrame(updateLoadingBar);
      } else if (progressRatio === 1.0) {
        loadingBarElement.classList.add("ended");
        const sourceElement = document.querySelector(".source-container");
        sourceElement.classList.add("ended");
      }
    };

    this.allPositions = [];

    for (let path of this.imagePaths) {
      const data = await this.loadData(path);
      const positions = this.generateVoronoiStippling(
        data,
        data.width,
        data.height,
        Math.round((data.width * data.height) / 10)
      );
      const normalizedPositions = this.normalizePositions(
        positions,
        data.width,
        data.height
      );
      this.allPositions.push(normalizedPositions);
      loadedItemCount++;
      progressRatio = loadedItemCount / this.imagePaths.length;
      requestAnimationFrame(updateLoadingBar);
    }

    this.textures = [];
    // loop through image paths and create textures
    for (let path of this.imageNames) {
      const texture = await WebGLUtility.createTextureFromFile(this.gl, path);
      this.textures.push(texture);
    }
    this.texture0 = this.textures[0];
    this.texture1 = this.textures[1];
  }

  async loadData(path) {
    const image = await WebGLUtility.loadImage(path);
    const tempCanvas = document.createElement("canvas");
    const width = this.canvas.width;
    const height = Math.round(width * (image.height / image.width));
    tempCanvas.width = width;
    tempCanvas.height = height;

    /**Copyright 2018–2020 Mike Bostock */
    const context = tempCanvas.getContext("2d");
    context.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      0,
      0,
      width,
      height
    );
    const { data: rgba } = context.getImageData(0, 0, width, height);
    const data = new Float64Array(width * height);
    for (let i = 0, n = rgba.length / 4; i < n; i++)
      data[i] = Math.max(0, 1 - rgba[i * 4] / 254);
    data.width = width;
    data.height = height;

    return data;
  }

  /**
   * WebGL のレンダリングを開始する前のセットアップを行う。
   */
  setup() {
    const gl = this.gl;

    const cameraOption = {
      distance: 3.5,
      min: 1.0,
      max: 10.0,
      move: 2.0,
    };
    this.camera = new WebGLOrbitCamera(this.canvas, cameraOption);

    this.offsets = [];
    for (let i = 0; i < this.allPositions[0].length / 2; i++) {
      this.offsets.push(Math.random());
    }

    this.vbo = [
      WebGLUtility.createVbo(this.gl, this.allPositions[0]),
      WebGLUtility.createVbo(this.gl, this.allPositions[1]),
      WebGLUtility.createVbo(this.gl, this.offsets),
    ];

    const minX = -0.75,
      minY = -1.5;
    const maxX = 0.75,
      maxY = -1.0;
    const width = maxX - minX; // Width of the bounding box
    const height = maxY - minY; // Height of the bounding box

    this.vertices = [];
    this.coord = [];
    this.nameOffset = [];
    const wSeg = 300;
    const hSeg = 90;
    for (let y = 0; y < hSeg; y++) {
      for (let x = 0; x < wSeg; x++) {
        let normalizedX = x / wSeg; // Normalized x coordinate (0 to 1)
        let normalizedY = y / hSeg; // Normalized y coordinate (0 to 1)

        this.coord.push(normalizedX, normalizedY);

        // Map to bounding box
        let mappedX = minX + normalizedX * width;
        let mappedY = maxY - normalizedY * height;

        // Add mapped coordinates to vertices
        this.vertices.push(mappedX, mappedY);
        this.nameOffset.push(Math.random());
      }
    }
    this.nameVbo = [
      WebGLUtility.createVbo(this.gl, this.vertices),
      WebGLUtility.createVbo(this.gl, this.coord),
      WebGLUtility.createVbo(this.gl, this.nameOffset),
    ];

    this.resize();
    this.running = true;
    this.previousTime = Date.now();

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);

    // Set up texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texture1);
  }

  /**
   * ジオメトリ（頂点情報）を構築するセットアップを行う。
   */
  /**Copyright 2018–2020 Mike Bostock */
  generateVoronoiStippling(data, width, height, n) {
    const positions = new Float64Array(n * 2);
    const c = new Float64Array(n * 2);
    const s = new Float64Array(n * 2);

    // Initialize the points using rejection sampling
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 30; j++) {
        const x = (positions[i * 2] = Math.floor(Math.random() * width));
        const y = (positions[i * 2 + 1] = Math.floor(Math.random() * height));
        if (Math.random() < data[y * width + x]) {
          break;
        }
      }
    }

    // Perform Voronoi relaxation
    const delaunay = new d3.Delaunay(positions);
    const voronoi = delaunay.voronoi([0, 0, width, height]);

    for (let k = 0; k < 80; k++) {
      c.fill(0);
      s.fill(0);

      for (let y = 0, i = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const w = data[y * width + x];
          i = delaunay.find(x + 0.5, y + 0.5, i);
          s[i] += w;
          c[i * 2] += w * (x + 0.5);
          c[i * 2 + 1] += w * (y + 0.5);
        }
      }

      for (let i = 0; i < n; i++) {
        const x0 = positions[i * 2],
          y0 = positions[i * 2 + 1];
        const x1 = s[i] ? c[i * 2] / s[i] : x0;
        const y1 = s[i] ? c[i * 2 + 1] / s[i] : y0;
        const w = Math.pow(k + 1, -0.8) * 10;
        positions[i * 2] = x0 + (x1 - x0) * 1.8 + (Math.random() - 0.5) * w;
        positions[i * 2 + 1] = y0 + (y1 - y0) * 1.8 + (Math.random() - 0.5) * w;
      }

      voronoi.update();
    }

    return positions;
  }

  /** Normalize voronoi position */
  normalizePositions(positions, width, height) {
    // Aspect ratios
    const imageAspectRatio = width / height;
    const canvasAspectRatio = this.canvas.width / this.canvas.height;

    // Determine the scaling factor
    let scaleFactor =
      canvasAspectRatio > imageAspectRatio ? 2.0 / height : 2.0 / width;

    // Normalize positions
    return positions.map((v, i) => {
      if (i % 2 == 0) {
        return (v - width / 2) * scaleFactor;
      } else {
        return -(v - height / 2) * scaleFactor;
      }
    });
  }

  updateVBOs() {
    if (this.vbo && this.vbo.length > 0) {
      this.vbo.forEach((vbo) => this.gl.deleteBuffer(vbo));
    }

    this.vbo = [
      WebGLUtility.createVbo(this.gl, this.position1),
      WebGLUtility.createVbo(this.gl, this.position2),
      WebGLUtility.createVbo(this.gl, this.offsets),
    ];
  }

  repeatAnimation() {
    gsap.to(this.timeObject, {
      value: 1.0,
      duration: 4.0,
      ease: "power2.inOut",
      delay: 2.0,
      repeatDelay: 1.0,
      repeat: -1,
      onRepeat: async () => {
        // Stop animation and update image index
        this.running = false;
        this.imageIndex = (this.imageIndex + 1) % this.imagePaths.length;
        const nextIndex = (this.imageIndex + 1) % this.imagePaths.length;

        // Update source
        this.source.innerHTML = this.sources[this.imageIndex];

        // Update offsets
        this.offsets = [];
        for (let i = 0; i < this.allPositions[0].length / 2; i++) {
          this.offsets.push(Math.random());
        }

        // Switch positions
        this.position1 = this.allPositions[this.imageIndex];
        this.position2 = this.allPositions[nextIndex];

        // Update textures
        this.texture0 = this.textures[this.imageIndex];
        this.texture1 = this.textures[nextIndex];

        // Update VBOs accordingly
        this.updateVBOs();

        this.running = true;
      },
    });
  }

  /**
   * WebGL を利用して描画を行う。
   */
  render() {
    // 短く書けるようにローカル変数に一度代入する
    const gl = this.gl;
    const m4 = WebGLMath.Mat4;
    const v3 = WebGLMath.Vec3;

    // running が true の場合は requestAnimationFrame を呼び出す
    if (this.running === true) {
      requestAnimationFrame(this.render);
    }

    // ビューポートの設定と背景色・深度値のクリア
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // - 各種行列を生成する ---------------------------------------------------
    // モデル座標変換行列
    const m = m4.identity();

    // ビュー座標変換行列（WebGLOrbitCamera から行列を取得する）
    const v = this.camera.update();

    // プロジェクション座標変換行列
    const fovy = 60; // 視野角（度数）
    const aspect = this.canvas.width / this.canvas.height; // アスペクト比
    const near = 0.1; // ニア・クリップ面までの距離
    const far = 20.0; // ファー・クリップ面までの距離
    const p = m4.perspective(fovy, aspect, near, far);

    // 行列を乗算して MVP 行列を生成する（行列を掛ける順序に注意）
    const vp = m4.multiply(p, v);
    const mvp = m4.multiply(vp, m);
    // ------------------------------------------------------------------------

    // プログラムオブジェクトを指定し、VBO と uniform 変数を設定
    this.shaderProgram.use();
    this.shaderProgram.setAttribute(this.vbo);
    this.shaderProgram.setUniform([mvp, this.timeObject.value]);

    // 設定済みの情報を使って、頂点を画面にレンダリングする
    gl.drawArrays(gl.POINTS, 0, this.allPositions[0].length / 2);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texture1);

    this.nameShaderProgram.use();
    this.nameShaderProgram.setAttribute(this.nameVbo);
    this.nameShaderProgram.setUniform([mvp, this.timeObject.value, 0, 1]);
    gl.drawArrays(gl.POINTS, 0, this.vertices.length / 2);
  }

  /**
   * リサイズ処理を行う。
   */
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  /**
   * WebGL を実行するための初期化処理を行う。
   * @param {HTMLCanvasElement|string} canvas - canvas への参照か canvas の id 属性名のいずれか
   * @param {object} [option={}] - WebGL コンテキストの初期化オプション
   */
  init(canvas, option = {}) {
    if (canvas instanceof HTMLCanvasElement === true) {
      this.canvas = canvas;
    } else if (Object.prototype.toString.call(canvas) === "[object String]") {
      const c = document.querySelector(`#${canvas}`);
      if (c instanceof HTMLCanvasElement === true) {
        this.canvas = c;
      }
    }
    if (this.canvas == null) {
      throw new Error("invalid argument");
    }
    this.gl = this.canvas.getContext("webgl", option);
    if (this.gl == null) {
      throw new Error("webgl not supported");
    }
  }
}
