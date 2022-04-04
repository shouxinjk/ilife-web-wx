
//将broker写入顶部
function insertBroker(broker){
    $("#brokerHint").empty();
    $("#brokerHint").append("<span id='brokerBalance'>阅豆: "+(broker.points?broker.points:0)+'</span><button type="submit" class="btn-charge" id="btnCharge">充值</button>');
    //注册充值事件：显示充值表单
    $("#btnCharge").click(function(){
        loadPointProducts();
    });
}

//加载充值产品列表
function loadPointProducts(){
    $.ajax({
        url:app.config.sx_api+"/wx/wxPoints/rest/all",
        type:"get",        
        success:function(res){
            console.log("got available point products.",res);
            showPointProducts(res);
        }
    }) 
}

//将阅豆产品显示到界面供选择
//选择后触发充值。充值完成后返回
var selectedPointProduct = null;
function showPointProducts(products){
    $("#chargeDiv").empty();//先清空已有列表
    //逐条显示阅豆产品
    products.forEach(function(item){
        var html = "<div class='poor-topping-block poor-topping-enabled' id='product"+item.id+"' data-price='"+item.price+"' data-points='"+item.points+"'>"
        +"<div class='poor-topping-name'>"+item.name+"</div>"
        +"<div class='poor-topping-price'>￥"+(item.price/100)+"</div>"
        +"</div>";
        $("#chargeDiv").append(html);

        $("#product"+item.id).click(function(){
            selectedPointProduct = $(this).attr("id").replace(/product/,"");
            //TODO 发起充值，在充值成功后更新阅豆
            //以下仅用于测试后端API
            var wxPayResultMock = {
                out_trade_no:"test"+new Date().getTime(),
                result_code:"SUCCESS"           
            };
            purchasePoints(wxPayResultMock);
            //测试代码结束            
        });
    });

    //显示充值表单
    $.blockUI({ message: $('#chargeForm'),
        css:{ 
            padding:        10, 
            margin:         0, 
            width:          '80%', 
            top:            '10%', 
            left:           '10%', 
            textAlign:      'center', 
            color:          '#000', 
            border:         '1px solid silver', 
            backgroundColor:'#fff', 
            cursor:         'normal' 
        },
        overlayCSS:  { 
            backgroundColor: '#000', 
            opacity:         0.7, 
            cursor:          'normal' 
        }
    });    
}


//完成充值：仅在支付成功后提交。其他不做考虑：如果支付取消，或中途退出？？
//提交数据包括：达人ID或达人openid，阅豆产品
function purchasePoints(wxPayResult){
    //提交购买记录
    $.ajax({
        url:app.config.sx_api+"/wx/wxPaymentPoint/rest/purchase",
        type:"post", 
        data:JSON.stringify({
            productId:selectedPointProduct,
            brokerId:broker&&broker.id?broker.id:"",//brokerId与brokerOpenid至少传递一个
            brokerOpenid:userInfo._key,
            out_trade_no:wxPayResult.out_trade_no,
            result_code:wxPayResult.result_code
        }),    
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },             
        success:function(res){
            console.log("points purchased.",res);
            $.unblockUI(); 
            if(res.success){//不处理重复购买的情况
                siiimpleToast.message('恭喜，充值成功，'+res.data.points.points+'阅豆已到账~~',{
                      position: 'bottom|center'
                    });  
                //更新到界面 
                if(broker&&broker.points){
                    broker.points = broker.points + res.data.points.points;
                    insertBroker(broker);
                }             
            }
        }
    });
}






