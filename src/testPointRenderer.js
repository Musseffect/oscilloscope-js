var TestPointRenderer = (function(){
    const vertexShaderSourceFade = `#version 300 es
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
        color.xyz = fade*texture(backbuffer,fPosition).xyz;
        color.w = 1.0;
	}`;
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
	}`;

    const resolution = 1024;

    let pointCounter = 0;
    var frameCounter = 0;
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
    PointRenderer.init(gl);
    PointRenderer.viewport(-1,-1,2,2);
    gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.clearColor(0,0,0,1);
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
    var vertexShaderFade = new Shader(gl, gl.VERTEX_SHADER, vertexShaderSourceFade);
    var vertexShaderRenderBuffer = new Shader(gl,gl.VERTEX_SHADER, vertexShaderSourceRenderBuffer);
    var fragmentShaderFade = new Shader(gl, gl.FRAGMENT_SHADER, fragmentShaderSourceFade);
    var fragmentShaderRenderBuffer = new Shader(gl, gl.FRAGMENT_SHADER, fragmentShaderSourceRenderBuffer);
    
    programs.fade = new ShaderProgram(gl, vertexShaderFade, fragmentShaderFade);
    programs.renderBuffer = new ShaderProgram(gl, vertexShaderRenderBuffer, fragmentShaderRenderBuffer);


    const gui = new dat.GUI();
    var ui = {
        xNew:"cos(y)+sin(x+cos(z))",
        yNew:"0",
        zNew:"z*2.26*(1-z)",
        x0:"0",
        y0:"0.5",
        z0:"0.5",
        xProj:"x",
        yProj:"y",
        pointsPerFrame:300,
        maxPoints:"10e8",
        bias:0,
        gain:1,
        fade:1,
        gamma:2.2,
        sigma:10,
        color:"#FFFFFF",
        pause:false,
        restart:false,
        save:false
    };
    gui.remember(ui);
    gui.add(ui,'xNew');
    gui.add(ui,'yNew');
    gui.add(ui,'zNew');
    gui.add(ui,'x0');
    gui.add(ui,'y0');
    gui.add(ui,'z0');
    gui.add(ui,'xProj');
    gui.add(ui,'yProj');
    gui.add(ui,'pointsPerFrame',1,3000,1);
    gui.add(ui,"maxPoints");
    gui.add(ui,'bias',0,2,0.01);
    gui.add(ui,'gain',0,10,0.001);
    gui.add(ui,'fade',0,1,0.01);
    gui.add(ui,'gamma',0,4,0.1);
    gui.add(ui,'sigma',0,20,0.1);
    gui.addColor(ui,'color');
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
    function renderPoints(){
        const maxPoints = parseInt(ui.maxPoints);
        let xNew = yNew = zNew = null;
        let xProj = yProj = null;
        let color = colorValues(ui.color);
        color = [color[0],color[1],color[2]];
        try{
            xNew = Exp.compile(ui.xNew,["x","y","z"]);
            yNew = Exp.compile(ui.yNew,["x","y","z"]);
            zNew = Exp.compile(ui.zNew,["x","y","z"]);
            xProj = Exp.compile(ui.xProj,["x","y","z"]);
            yProj = Exp.compile(ui.yProj,["x","y","z"]);
        }catch(e){
            return;
        }
        let counter = 0;
        while(pointCounter<maxPoints&&counter<ui.pointsPerFrame){
            p = [xNew.$eval(p),yNew.$eval(p),zNew.$eval(p)];
            const projected = [clamp(xProj.$eval(p),-1,1),clamp(yProj.$eval(p),-1,1)];
            PointRenderer.addPoint(projected,color,ui.sigma/resolution);
            counter++;
        }  
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE,gl.ONE); 
        backbuffers[currentTexture].use(gl);
        gl.viewport(0,0,resolution,resolution);
        PointRenderer.renderFrame();
        PointRenderer.clear();
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
        programs.fade.setUniform("fade",ui.fade);
        programs.fade.bindUniforms(gl);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.viewport(0,0,resolution,resolution);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }

    let p = [0,0,0];
    function frame(){
        resize(gl.canvas);
        if(ui.restart){
            pointCounter = 0;
            p = [parseFloat(ui.x0),parseFloat(ui.y0),parseFloat(ui.z0)];
            ui.restart = false;
        }
        if(!ui.pause){
            renderPoints();
        }
        //render backbuffer to a screen
        renderBuffer();
        //apply fade
        if(!ui.pause){
            applyFading();
            currentTexture = 1-currentTexture;
            frameCounter++;
        }

        if(ui.save){
            //TODO
            ui.save = false;
        }
        frameId = window.requestAnimationFrame(frame);
    } 

    return {
        run:function(){
            p = [parseFloat(ui.x0),parseFloat(ui.y0),parseFloat(ui.z0)];
            window.requestAnimationFrame(frame);
        }

    };
})();

TestPointRenderer.run();