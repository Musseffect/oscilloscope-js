`(function(){
    function applyFade(){//TODO

    }
    function postProcess(){


        gl.drawArray(gl.TRIANGLE_STRIP,0,8);
    }
    function getPoint(p){
        /*let r = ((-p[1]/2+0.5)*2+2);
        let x = p[0]*0.5+0.5;
        return [
            x*(1.-x)*r*2-1,
            p[1]
        ];*/
        return [
            Math.sin(p[0]*10.0111+0.231)*0.3+Math.cos(p[1]*4.0)*0.2,
            Math.cos(p[0]*2.013-1.02)+Math.sin(p[1]*2.21+4.0321)
        ];
    }
    var frameCounter = 0;
    function frame(){
        //p = [((frameCounter/10)%1)*2-1.0+Math.random()*0.2,0.0+Math.random()*2-1];
        frameCounter++;
        for(let i=0;i<48000/16;i++){
            p = getPoint(p);
            let a = Math.cos(p[0]*2.2)*0.5+0.5;
            let b = Math.cos(p[0]*2.3+2.*Math.sin(p[1]*2.2))*0.5+0.5;
            let c = Math.sin(Math.cos(p[0]*0.2+p[1]*0.3)*3.1+Math.sin(p[0]*0.4+p[1]*1.3)*2.1)*0.5+0.5;
            //if(i>100)
            PointRenderer.addPoint(p,[0.000025,0.00001,0.00001],0.004);
        }
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE,gl.ONE);
        gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
        //gl.clearColor(0, 0, 0, 1);
        //gl.clear(gl.COLOR_BUFFER_BIT);
        PointRenderer.renderFrame();
        PointRenderer.clear();

        //applyFade();

        frameId = window.requestAnimationFrame(frame);
    }
    var frameId = 0;
    var p = [0.5,0.5,0.5];
    var canvas = document.getElementById("canvas"); 
    var gl = canvas.getContext("webgl2",{ preserveDrawingBuffer: true });
    if (!gl) {
        alert("HAHA, U CANT USE WEBGL 2, POOR GUY, HAHAHAH, plz sry");
        return;
    }
    PointRenderer.init(gl);
    gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    frameId = window.requestAnimationFrame(frame);
}
)();*/`;

TestLineRenderer.run();