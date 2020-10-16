
var TestLineRenderer = (function(){
    const saveImage = (function(){
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display="none";
        return function(blob,filename){
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = filename;
            a.click();
        }
    })();
    const vertexShaderSourcePostProcessing = `#version 300 es
    layout (location=0)in vec2 position;
    out vec2 fPosition;

    void main(){
        fPosition = position*0.5+0.5;
        gl_Position = vec4(position,0.,1.);
    }`;

    const fragmentShaderSourceFade = `#version 300 es
    precision highp float;
    
    in vec2 fPosition;
    uniform sampler2D backbuffer;
    uniform float fade;
    out vec4 color;

    
	void main(){
        color.xyz = exp(-fade)*texture(backbuffer,fPosition).xyz;
        color.w = 1.0;
	}
    `;
    const vertexShaderSourceRenderBuffer = `#version 300 es
    layout (location=0)in vec2 position;
    out vec2 fPosition;
    uniform vec2 scale;//scale for precise texture fitting in default framebuffer

    void main(){
        fPosition = position*0.5+0.5;
        gl_Position = vec4(position*scale,0.,1.);
    }`;

    const fragmentShaderSourceRenderBuffer = `#version 300 es
    precision highp float;
    
    in vec2 fPosition;
    uniform sampler2D backbuffer;
    uniform float gain;
    uniform float bias;
    uniform float gamma;

    out vec4 color;
    
	void main(){
        vec3 value = texture(backbuffer,fPosition).xyz;
        color.xyz = 1. - exp(-gain*(value)-bias);
        color.xyz = pow(color.xyz,vec3(gamma));
        color.w = 1.0;
	}
    `;
    const resolution = 1024;

    function getNextPoint(p,t){
        return [
            //0.5+0.5*Math.cos(t/sweeptime*2*Math.PI*13.71),
            (t)%1,
            Math.sin(t*2*Math.PI*100.0)
        ];
    }
    
    Exp.defineFunction("noise",noise);
    Exp.defineFunction("rand",Math.random);

    var timer = 0;
    var frameCounter = 0;
    const frametime = 1/60;
    var frameId = 0;
    var p = [0.0,0.0];
    var c = 1.0;
    var canvas = document.getElementById("canvas"); 
    var gl = canvas.getContext("webgl2",{ preserveDrawingBuffer: true });
    if (!gl) {
        alert("HAHA, U CANT USE WEBGL 2, POOR GUY, HAHAHAH, plz sry");
        return;
    }
    let extensionsList = [
        "EXT_color_buffer_float",
        "OES_texture_float_linear"
    ];
    let extensions = {};
    for(let i=0;i<extensionsList.length;i++)
    {
        let extension = gl.getExtension(extensionsList[i]);
        if(extension==null)
        {
            window.alert(extensionsList[i] +" is unsupported");
        }
        extensions[extensionsList[i]] = extension;
    }
    LineRenderer.init(gl);
    LineRenderer.viewport(-1,-1,2,2);
    gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var currentTexture = 0;
    var backbufferTexture = [
        new Texture2D(gl,0,gl.RGBA32F ,resolution,resolution,0,gl.RGBA,gl.FLOAT,null,
            [
                {key:gl.TEXTURE_MAG_FILTER,value:gl.LINEAR},
                {key:gl.TEXTURE_MIN_FILTER,value:gl.LINEAR},
                {key:gl.TEXTURE_WRAP_S,value:gl.CLAMP_TO_EDGE},
                {key:gl.TEXTURE_WRAP_T,value:gl.CLAMP_TO_EDGE},
                {key:gl.TEXTURE_WRAP_R,value:gl.CLAMP_TO_EDGE}
            ]),
        new Texture2D(gl,0,gl.RGBA32F ,resolution,resolution,0,gl.RGBA,gl.FLOAT,null,
            [
                {key:gl.TEXTURE_MAG_FILTER,value:gl.LINEAR},
                {key:gl.TEXTURE_MIN_FILTER,value:gl.LINEAR},
                {key:gl.TEXTURE_WRAP_S,value:gl.CLAMP_TO_EDGE},
                {key:gl.TEXTURE_WRAP_T,value:gl.CLAMP_TO_EDGE},
                {key:gl.TEXTURE_WRAP_R,value:gl.CLAMP_TO_EDGE}
            ])
    ];
    var backbuffers=[
        new FBO(gl, backbufferTexture[0], gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, 0),
        new FBO(gl, backbufferTexture[1], gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, 0)
    ];

	var quad = {buffer:null,vao:null};
    quad.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(
        [-1,1,
        -1,-1,
        1,1,
        1,-1]),gl.STATIC_DRAW);
    quad.vao = gl.createVertexArray();
    gl.bindVertexArray(quad.vao);
    gl.enableVertexAttribArray(0);
    var size = 2;          
    var type = gl.FLOAT;   
    var normalize = false; 
    var stride = 0;   
    var offset = 0;  
    gl.vertexAttribPointer(
        0, size, type, normalize, stride, offset);
    gl.bindVertexArray(null);
    
    var programs={fade:null,renderBuffer:null};
    var vertexShaderPostProcessing = new Shader(gl, gl.VERTEX_SHADER, vertexShaderSourcePostProcessing);
    var vertexShaderRenderBuffer = new Shader(gl,gl.VERTEX_SHADER, vertexShaderSourceRenderBuffer);
    var fragmentShaderFade = new Shader(gl, gl.FRAGMENT_SHADER, fragmentShaderSourceFade);
    var fragmentShaderRenderBuffer = new Shader(gl, gl.FRAGMENT_SHADER, fragmentShaderSourceRenderBuffer);
    
    programs.fade = new ShaderProgram(gl, vertexShaderPostProcessing, fragmentShaderFade);
    programs.renderBuffer = new ShaderProgram(gl, vertexShaderRenderBuffer, fragmentShaderRenderBuffer);

    const gui = new dat.GUI();
    function saveTexture(){
        let renderTexture = new Texture2D(gl,0,gl.RGBA,resolution,resolution,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        let renderBuffer = new FBO(gl, renderTexture, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, 0);
        
        renderBuffer.use(gl);
        gl.bindVertexArray(quad.vao);
        backbufferTexture[currentTexture].bind(gl,0);
        programs.renderBuffer.use(gl);
        programs.renderBuffer.setUniform("backbuffer",0);
        programs.renderBuffer.setUniform("gain",ui.gain*0.001);
        programs.renderBuffer.setUniform("bias",ui.bias);
        programs.renderBuffer.setUniform("gamma",ui.gamma);
        programs.renderBuffer.setUniform("scale",[1,1]);
        programs.renderBuffer.bindUniforms(gl);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.viewport(0,0,resolution,resolution);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

        var pixels = new Uint8Array(resolution * resolution * 4);
        gl.readPixels(0, 0, resolution, resolution, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        renderTexture.destroy(gl);
        renderBuffer.destroy(gl);
        var _canvas = document.createElement("canvas");
        _canvas.width = resolution;
        _canvas.height = resolution;
        var _context = _canvas.getContext("2d");
        var imgData = _context.createImageData(resolution, resolution);
        const size = resolution*resolution;
        for(let i=0;i<size;i++){
            let x = i%resolution;
            let y = Math.floor(i/resolution);
            const j = x+(resolution-y-1)*resolution;
            imgData.data[i*4] = pixels[j*4];
            imgData.data[i*4+1] = pixels[j*4+1];
            imgData.data[i*4+2] = pixels[j*4+2];
            imgData.data[i*4+3] = 255;
        }
        _context.putImageData(imgData, 0, 0);
        _canvas.toBlob(function (blob){
            var today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
            const yyyy = String(today.getFullYear()).padStart(4, '0');
            const hh = String(today.getHours()).padStart(2, '0');
            const minmin = String(today.getMinutes()).padStart(2, '0');
            var str = mm + '-' + dd + '-' + yyyy + '_' + hh + '-' + minmin;
            saveImage(blob, `image_${str}.png`);
        });
    }
    var ui = {
        bias:0,
        gain:1,
        fade:2,
        gamma:2.2,
        sigma:10,
        color:"#FFFFFF",
        pause:false,
        ["snap to border"]:true,
        restart:function(){
            timer = 0.0;
            p = [0.,0.];
            c = 1.0;
            backbuffers[currentTexture].use(gl);
            gl.clear(gl.COLOR_BUFFER_BIT);

        },
        save:saveTexture,
        expX:"lerp(-1,1,frac(t))",
        expY:"sin(t*2*pi())",
        expZ:"1",
        linesPerFrame:500
    }
    gui.remember(ui);
    gui.add(ui,'expX');
    gui.add(ui,'expY');
    gui.add(ui,'expZ');
    gui.add(ui,'bias',0,2,0.01);
    gui.add(ui,'gain',0,10,0.001);
    gui.add(ui,'fade',0,20,0.1);
    gui.add(ui,'gamma',0,4,0.1);
    gui.add(ui,'snap to border');
    gui.addColor(ui,'color');
    gui.add(ui,'sigma',0,20,0.1);
    gui.add(ui,'linesPerFrame',2,3000,1);
    gui.add(ui,'pause');
    gui.add(ui,'restart');
    gui.add(ui,'save');

    function resize(canvas) {
        // Lookup the size the browser is displaying the canvas.
        var displayWidth  = canvas.clientWidth;
        var displayHeight = canvas.clientHeight;
       
        // Check if the canvas is not the same size.
        if (canvas.width  != displayWidth ||
            canvas.height != displayHeight) {
       
          // Make the canvas the same size
          canvas.width  = displayWidth;
          canvas.height = displayHeight;
        }
    }      
    function renderLines(){
        const points = ui.linesPerFrame;
        let expX = expY = expZ = {$eval:()=>{return 0;}};
        try{
            expX = Exp.compile(ui.expX,["t"]);
            expY = Exp.compile(ui.expY,["t"]);
            expZ = Exp.compile(ui.expZ,["t"]);
        }catch(e){
        }
        let color = colorValues(ui.color);
        for(let i=0;i<points;i++){
            timer+=frametime/points;
            //let pNext = getNextPoint(p,timer);
            let pNext = [expX.$eval([timer]),expY.$eval([timer])];
            if(ui["snap to border"]){
                pNext = [clamp(pNext[0],-1,1),clamp(pNext[1],-1,1)];
            }
            let cNext = expZ.$eval([timer]);
            let factor = clamp(expZ.$eval([timer])/points,0,1);
            LineRenderer.addLine(p,pNext,[color[0]*factor,color[1]*factor,color[2]*factor],ui.sigma/resolution,c,cNext);
            p = pNext.slice();
            c = cNext;
        }
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE,gl.ONE);
        //gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
        /*LineRenderer.addLine([0.1,0.8],[0.9,0.8],[1.95,1.95,1.95],0.003);
        LineRenderer.addLine([0.9,0.8],[0.9,-0.8],[1.95,1.95,1.95],0.003);*/

        //render lines to backbuffer
        /*gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);*/
        backbuffers[currentTexture].use(gl);
        gl.viewport(0,0,resolution,resolution);
        LineRenderer.renderFrame();
        LineRenderer.clear();
    }
    function renderBuffer(){
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindVertexArray(quad.vao);
        backbufferTexture[currentTexture].bind(gl,0);
        programs.renderBuffer.use(gl);
        programs.renderBuffer.setUniform("backbuffer",0);
        programs.renderBuffer.setUniform("gain",ui.gain*0.001);
        programs.renderBuffer.setUniform("bias",ui.bias);
        programs.renderBuffer.setUniform("gamma",ui.gamma);
        let backbufferRatio = 1;
        let screenRatio = gl.canvas.height/gl.canvas.width;
        //scale backbuffer image so it would fit in canvas
        //haha learnt how to do it by working with openframeworks
        let scale = [];
        if(screenRatio>backbufferRatio)
            scale = [1,gl.canvas.width*backbufferRatio/gl.canvas.height];
        else
            scale = [gl.canvas.height/gl.canvas.width/backbufferRatio,1];
        programs.renderBuffer.setUniform("scale",scale);
        programs.renderBuffer.bindUniforms(gl);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    function applyFading(){
        backbuffers[1-currentTexture].use(gl);
        programs.fade.use(gl);
        backbufferTexture[currentTexture].bind(gl,0);
        programs.fade.setUniform("backbuffer",0);
        programs.fade.setUniform("fade",ui.fade*frametime);
        programs.fade.bindUniforms(gl);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.viewport(0,0,resolution,resolution);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    function frame(){
        resize(gl.canvas);
        
        if(!ui.pause){
            renderLines();
        }
        //render backbuffer to a screen
        renderBuffer();
        //apply fade
        if(!ui.pause){
            applyFading();
            //switch buffers
            currentTexture=1-currentTexture;
            frameCounter++;
        }
        frameId = window.requestAnimationFrame(frame);
    }


    return {
        run:function(){
            //p = getNextPoint(p,timer);
            window.requestAnimationFrame(frame);
        }
    };
})();

TestLineRenderer.run();





