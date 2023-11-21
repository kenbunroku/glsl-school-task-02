import { WebGLUtility, ShaderProgram } from "./lib/webgl";
import { WebGLMath } from "./lib/math";
import { WebGLOrbitCamera } from "./lib/camera";
import { Pane } from "./lib/tweakpane-4.0.0.min.js";
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

    this.imageIndex = 0;
    this.imagePaths = [
      "/assets/takamori_saigo.png",
      "/assets/toshimichi_ohkubo.png",
      "/assets/takayoshi_kido.png",
      "/assets/tatewaki_komatsu.png",
      "/assets/masujiro_ohmura.png",
      "/assets/issei_maebara.png",
      "/assets/saneomi_hirosawa.png",
      "/assets/shinpei_eto.png",
      "/assets/yokoi_shonan.png",
      "/assets/tomomi_iwakura.png",
      "/assets/ryoma_sakamoto.png",
    ];

    // 各種パラメータや uniform 変数用
    this.previousTime = 0; // 直前のフレームのタイムスタンプ
    this.timeScale = 1.0; // 時間の進み方に対するスケール
    this.uTime = 0.0; // uniform 変数 time 用
    this.timeObject = { value: 0 };
    this.uRatio = 0.0; // 変化の割合い

    // const pane = new Pane();
    // pane
    //   .addBlade({
    //     view: "slider",
    //     label: "time-scale",
    //     min: 0.0,
    //     max: 2.0,
    //     value: this.timeScale,
    //   })
    //   .on("change", (v) => {
    //     this.timeScale = v.value;
    //   });
    // pane
    //   .addBlade({
    //     view: "slider",
    //     label: "ratio",
    //     min: 0.0,
    //     max: 1.0,
    //     value: this.uRatio,
    //   })
    //   .on("change", (v) => {
    //     this.uRatio = v.value;
    //   });
  }
  /**
   * シェーダやテクスチャ用の画像など非同期で読み込みする処理を行う。
   * @return {Promise}
   */
  async load() {
    const vs = await WebGLUtility.loadFile("./shaders/main.vert");
    const fs = await WebGLUtility.loadFile("./shaders/main.frag");
    this.shaderProgram = new ShaderProgram(this.gl, {
      vertexShaderSource: vs,
      fragmentShaderSource: fs,
      attribute: ["position1", "position2", "offset"],
      stride: [2, 2, 1],
      uniform: ["mvpMatrix", "ratio"],
      type: ["uniformMatrix4fv", "uniform1f"],
    });

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
    }
  }

  async loadData(path) {
    const image = await WebGLUtility.loadImage(path);
    const tempCanvas = document.createElement("canvas");
    const width = this.canvas.width;
    const height = Math.round(width * (image.height / image.width));
    tempCanvas.width = width;
    tempCanvas.height = height;
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
      distance: 3.0,
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

    this.resize();
    this.running = true;
    this.previousTime = Date.now();

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
  }

  /**
   * ジオメトリ（頂点情報）を構築するセットアップを行う。
   */
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
      delay: 1.0,
      repeatDelay: 1.0,
      repeat: -1,
      onRepeat: async () => {
        this.running = false;
        this.imageIndex = (this.imageIndex + 1) % this.imagePaths.length;
        const nextIndex = (this.imageIndex + 1) % this.imagePaths.length;

        this.offsets = [];
        for (let i = 0; i < this.allPositions[0].length / 2; i++) {
          this.offsets.push(Math.random());
        }

        // Switch positions
        this.position1 = this.allPositions[this.imageIndex];
        this.position2 = this.allPositions[nextIndex];

        // Update VBOs accordingly
        this.updateVBOs();

        this.running = true;
        // await this.updateData();
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

    // 直前のフレームからの経過時間を取得
    const now = Date.now();
    const time = (now - this.previousTime) / 1000;
    this.uTime += time * this.timeScale;
    this.previousTime = now;

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