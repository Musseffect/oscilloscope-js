const OscilloscopeIntegrator = (function(){
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
    uniform vec4 gridColor;

    out vec4 color;
    
    float triang(float x){
        return abs(1.-fract(x/2.)*2.);
    }
    vec2 triang(vec2 x){
        return abs(1.-fract(x/2.)*2.);
    }
    float gridAnalog(vec2 uv){
        const float scale = 5.0;
        uv*=scale;
        vec2 fuv = triang((uv+0.5)*2.0);

        //float maskX = smoothstep(-0.02,0.04,fuv.x);
        float maskX = 1.-exp(-fuv.x*fuv.x*400.03);

        //float maskY = smoothstep(-0.02,0.04,fuv.y);
        float maskY = 1.-exp(-fuv.y*fuv.y*400.03);
        float mask = maskX*maskY;
        float arg = min(fuv.y,fuv.x);
        float tMaskY = smoothstep(0.12,0.05,arg);
        arg = triang(max(fuv.x,fuv.y)*5.0+1.0)*0.5;
        float tMaskX = smoothstep(0.08,0.025,arg);
        arg = min(abs(uv.y),abs(uv.x));
        float mtMaskY = smoothstep(0.1,0.05,arg);
        return mask*(1.-tMaskX*mtMaskY)*(1.-tMaskX*tMaskY);
    }

	void main(){
        vec3 value = texture(backbuffer,fPosition).xyz;
        color.xyz = 1. - exp(-gain*(value));
        color.xyz = pow(color.xyz,vec3(gamma)) + bias;
        color.w = 1.0;
        float g = gridAnalog(fPosition*2.-1.);
        color.xyz=mix(color.xyz,gridColor.xyz,(1.-g)*gridColor.a);
	}
    `;
    Exp.defineFunction("noise",noise);
    Exp.defineFunction("rand",Math.random);
    const resolution = 1024;
    var time = 0;
    var p = [0,0,0];
    var pProj = [0,0];
    var intens = 1;
    var frameId = 0;
    //Init GL
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


    var ui = {
        dx:"sin(3.2*t*pi())*2.5",
        dy:"0",
        dz:"0",
        x0:"-0.25",
        y0:"0.0",
        z0:"0.0",
        xProj:"frac(t)*2-1",
        yProj:"frac(x*0.5+0.5)*2-1",
        intensity:"1",
        bias:0.1,
        gain:-1.5,
        fade:1.5,
        gamma:2.2,
        ["snap to border"]:true,
        color:"#FFFFFF",
        ['grid color']:'#02bb94',
        ['grid opacity']:1,
        sigma:10,
        integrationsPerLine:1,
        linesPerFrame:4,
        frameTime:1/60,
        pause:false,
        restart:reset,
        save:saveTexture
    };
    const gui = new dat.GUI();
    gui.remember(ui);
    gui.add(ui,'dx');
    gui.add(ui,'dy');
    gui.add(ui,'dz');
    gui.add(ui,'x0');
    gui.add(ui,'y0');
    gui.add(ui,'z0');
    gui.add(ui,'xProj');
    gui.add(ui,'yProj');
    gui.add(ui,'intensity');
    gui.add(ui,'bias',0,1,0.01);
    gui.add(ui,'gain',-5,5,0.001);
    gui.add(ui,'fade',0,20,0.1);
    gui.add(ui,'gamma',0,4,0.1);
    gui.add(ui,'snap to border');
    gui.addColor(ui,'color');
    gui.addColor(ui,'grid color');
    gui.add(ui,'grid opacity',0,1,0.01);
    gui.add(ui,'sigma',0,20,0.1);
    gui.add(ui,'integrationsPerLine',1,100,1);
    gui.add(ui,'linesPerFrame',1,3000,1);
    gui.add(ui,'frameTime',0,10,0.001);
    gui.add(ui,'pause');
    gui.add(ui,'restart');
    gui.add(ui,'save');

    function saveTexture(){
        let renderTexture = new Texture2D(gl,0,gl.RGBA,resolution,resolution,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        let renderBuffer = new FBO(gl, renderTexture, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, 0);
        
        let gridColor = colorValues(ui['grid color']);
        gridColor = [gridColor[0]/255,gridColor[1]/255,gridColor[2]/255,ui['grid opacity']];
        renderBuffer.use(gl);
        gl.bindVertexArray(quad.vao);
        backbufferTexture[currentTexture].bind(gl,0);
        programs.renderBuffer.use(gl);
        programs.renderBuffer.setUniform("backbuffer",0);
        programs.renderBuffer.setUniform("gain",Math.pow(2,ui.gain));
        programs.renderBuffer.setUniform("bias",ui.bias);
        programs.renderBuffer.setUniform("gamma",ui.gamma);
        programs.renderBuffer.setUniform("gridColor",gridColor);
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

    function addVec3(a,b){
        return [a[0] + b[0],a[1] + b[1],a[2] + b[2]];
    }
    function scaleVec3(a,scalar){
        return [a[0]*scalar,a[1]*scalar,a[2]*scalar];
    }
    function integrateRK4(p,t,step,F){
        let k1 = F(p,t);
        let k2 = F(addVec3(p,scaleVec3(k1,step/2)),t+step/2);
        let k3 = F(addVec3(p,scaleVec3(k2,step/2)),t+step/2);
        let k4 = F(addVec3(p,scaleVec3(k3,step)),t+step);
        return addVec3(p,scaleVec3(addVec3(addVec3(k1,k4),scaleVec3(addVec3(k2,k3),2)),step/6.));
    }
    function renderLines(){
        const dt = ui.frameTime/ui.linesPerFrame/ui.integrationsPerLine;
        let dx = dy = dz = {$eval:function(p){return 0;}};
        let xProj = yProj = intensity={$eval:function(p){return 0;}};
        let color = colorValues(ui.color);
        color = [color[0],color[1],color[2]];
        color = [color[0]/255,color[1]/255,color[2]/255];
        try{
            dx = Exp.compile(ui.dx,["x","y","z","t"]);
            dy = Exp.compile(ui.dy,["x","y","z","t"]);
            dz = Exp.compile(ui.dz,["x","y","z","t"]);
            xProj = Exp.compile(ui.xProj,["x","y","z","t"]);
            yProj = Exp.compile(ui.yProj,["x","y","z","t"]);
            intensity = Exp.compile(ui.intensity,["x","y","z","t"]);
        }catch(e){
            return;
        }
        const F = function(p, t){
            let args = p.concat(t);
            return [dx.$eval(args),dy.$eval(args),dz.$eval(args)];
        };
        for(let i=0;i<ui.linesPerFrame;i++){
            for(let j=0;j<ui.integrationsPerLine;j++){
                p = integrateRK4(p,time,dt,F);
                time+=dt;
            }
            let args = p.concat(time);
            let pProjNext = [xProj.$eval(args),yProj.$eval(args)];
            if(ui["snap to border"]){
                pProjNext = [clamp(pProjNext[0],-1,1),clamp(pProjNext[1],-1,1)];
            }
            let intensNext = clamp(intensity.$eval(args),0,1);
            let factor = intensNext/ui.linesPerFrame;
            LineRenderer.addLine(pProj,pProjNext,[color[0]*factor,color[1]*factor,color[2]*factor],ui.sigma/resolution,intens,intensNext);
            intens = intensNext;
            pProj = pProjNext;
        }
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE,gl.ONE);
        backbuffers[currentTexture].use(gl);
        gl.viewport(0,0,resolution,resolution);
        LineRenderer.renderFrame();
        LineRenderer.clear();
    }
    function renderBuffer(){
        
        let gridColor = colorValues(ui['grid color']);
        gridColor = [gridColor[0]/255,gridColor[1]/255,gridColor[2]/255,ui['grid opacity']];
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindVertexArray(quad.vao);
        backbufferTexture[currentTexture].bind(gl,0);
        programs.renderBuffer.use(gl);
        programs.renderBuffer.setUniform("backbuffer",0);
        programs.renderBuffer.setUniform("gain",Math.pow(2,ui.gain));
        programs.renderBuffer.setUniform("bias",ui.bias);
        programs.renderBuffer.setUniform("gamma",ui.gamma);
        programs.renderBuffer.setUniform("gridColor",gridColor);
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
    function applyFade(){
        backbuffers[1-currentTexture].use(gl);
        programs.fade.use(gl);
        backbufferTexture[currentTexture].bind(gl,0);
        programs.fade.setUniform("backbuffer",0);
        programs.fade.setUniform("fade",ui.fade*1./60.);//normalized fade
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
        renderBuffer();
        if(!ui.pause){
            applyFade();
            //switch buffers
            currentTexture=1-currentTexture;
        }
        frameId = window.requestAnimationFrame(frame);
    }
    function reset(){
        p = [parseFloat(ui.x0),parseFloat(ui.y0),parseFloat(ui.z0)];
        intens = 1;
        pProj = [0,0];
        time = 0;
        backbuffers[currentTexture].use(gl);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    return {
        run:function(){
            p = [parseFloat(ui.x0),parseFloat(ui.y0),parseFloat(ui.z0)];
            intens = 1;
            pProj = [0,0];
            frameId = window.requestAnimationFrame(frame);
        },
        stop:function(){
            window.cancelAnimationFrame(frameId);
        }
    };
}());

OscilloscopeIntegrator.run();