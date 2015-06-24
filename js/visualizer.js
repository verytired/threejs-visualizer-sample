var LoopVisualizer = (function() {

	var RINGCOUNT = 160;//リングの数
	var SEPARATION = 30;
	var INIT_RADIUS = 50;
	var SEGMENTS = 512; //リングの分割数
	var BIN_COUNT = 512;

	var rings = [];
	var levels = [];
	var colors = [];
	var loopHolder = new THREE.Object3D();
	var loopGeom;//one geom for all rings
	var freqByteData;
	var timeByteData;

	//Vizualizer Params
	var vizParams = {
		gain:1,
		separation: 0.05,
		scale: 1,
		zbounce: 1,
		autoTilt: false
	};


	function init() {

		////////INIT audio in
		//audioデータを取得する
		//周波数変化（スペクトラム）と時間軸変化の二つを取得する
		freqByteData = new Uint8Array(analyser.frequencyBinCount);
		timeByteData = new Uint8Array(analyser.frequencyBinCount);

		//create ring geometry
		//円は予めRINGCOUNT分用意してloopHolderに追加しておく

		//リンググラフィックの生成
		var loopShape = new THREE.Shape();
		////円を描く absarc(原点x,原点y,半径,start角度,end角度,???)
		loopShape.absarc( 0, 0, INIT_RADIUS, 0, Math.PI*2, false );
		//shapeにgeometoryの頂点データを生成する  //2点生成されるから半分の数の指定でいい？
		loopGeom = loopShape.createPointsGeometry(SEGMENTS/2);
		loopGeom.dynamic = true;

		//create rings
		scene.add(loopHolder);
		var scale = 1;
		for(var i = 0; i < RINGCOUNT; i++) {

			var m = new THREE.LineBasicMaterial( { color: 0xffffff,
				linewidth: 1 ,
				opacity : 0.7,
				blending : THREE.AdditiveBlending,
				depthTest : false,
				transparent : true
			});
			
			var line = new THREE.Line( loopGeom, m);

			rings.push(line);
			//scaleはdat-guiの値をあとで取得するのでここでの設定は無意味
			//scale *= 1.05;
			//line.scale.x = scale;
			//line.scale.y = scale;
			loopHolder.add(line);

			levels.push(0);
			colors.push(0);

		}

		//Init DAT GUI control panel
		var gui = new dat.GUI();			
		gui.add(vizParams, 'gain', 0.1, 3).name("Gain");
		gui.add(vizParams, 'separation', 0.001, 0.05).name("Separation").onChange(onParamsChange);
		gui.add(vizParams, 'scale', 0.1, 8).name("Scale").onChange(onParamsChange);
		gui.add(vizParams, 'zbounce', 0.01, 2).name("Z-Bounce");
		gui.add(vizParams, 'autoTilt').name("Auto Tilt");
		gui.close();

		//dat-guiのパラメータ取得　主にスケール変更
		onParamsChange();

	}


	function onParamsChange() {

		loopHolder.scale.x = loopHolder.scale.y = vizParams.scale;

		var scale = 1;
		for(var i = 0; i < RINGCOUNT; i++) {
			var line = rings[i];
			line.scale.x = scale;
			line.scale.y = scale;
			scale *= 1 + vizParams.separation;
		}

	}

	function update() {

		//visualizerのロジック
		//音量と色を配列に格納し、音データを取得する度に配列を更新する
		//色の変化と透過量を常に与えることによりアニメーションしているように見せる

		//波形表示はloopGeomが一つで全てのリングの頂点情報を制御している
		//z軸のサイズを保持しているlevel配列で決定させる
		//リングの波形は同じだか、levelは配列で管理され毎フレーム変化するためアニメーションしているように見える

		analyser.getByteFrequencyData(freqByteData); //周波数領域の波形データ (振幅スペクトル) を取得する
		analyser.getByteTimeDomainData(timeByteData);//時間領域の波形データを取得するメソッド

		//add a new average volume onto the list
		//平均化　ピークを合わせる　
		var sum = 0;
		for(var i = 0; i < BIN_COUNT; i++) {
			sum += freqByteData[i];
		}
		var aveLevel = sum / BIN_COUNT;
		var scaled_average = (aveLevel / 256) * vizParams.gain*2; //256 is the highest a level can be
		levels.push(scaled_average);
		levels.shift(1);

		//add a new color onto the list
		//生成するカラー決定
		var n = Math.abs(perlin.noise(noisePos, 0, 0));
		colors.push(n);
		colors.shift(1);

		//write current waveform into all rings
		//z軸変化はdbの時間軸変化で表す
		for(var j = 0; j < SEGMENTS; j++) {
			loopGeom.vertices[j].z = timeByteData[j]*2;//stretch by 2
		}
		// link up last segment
		loopGeom.vertices[SEGMENTS].z = loopGeom.vertices[0].z;
		loopGeom.verticesNeedUpdate = true;

		for( i = 0; i < RINGCOUNT ; i++) {
			//color,levelとringのindex順は逆なので逆から取っていindexを合わせる
			var ringId = RINGCOUNT - i - 1;
			var normLevel = levels[ringId] + 0.01; //avoid scaling by 0
			var hue = colors[i];
			rings[i].material.color.setHSL(hue, 1, normLevel*.8);
			rings[i].material.linewidth = normLevel*3;
			rings[i].material.opacity = normLevel;
			rings[i].scale.z = normLevel * vizParams.zbounce;//音量によってz軸の変化量を制御
		}

	}

	return {
		init:init,
		update:update,
		loopHolder:loopHolder,
		vizParams:vizParams
	};
}());