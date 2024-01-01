import {
  //後で使うものもまとめてインポート
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps,
}from 'aws-cdk-lib';

import{
  Code,
  Function,
  FunctionUrlAuthType,
  Runtime,
}from "aws-cdk-lib/aws-lambda"

import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment,Source } from "aws-cdk-lib/aws-s3-deployment";  
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginAccessIdentity,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  PriceClass,
} from "aws-cdk-lib/aws-cloudfront"
import{
  HttpOrigin,
  S3Orign,
} from "aws-cdk-lib/aws-cloudfront-origins"

export class NeoReshipiCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    //--S3のバケット作成
    const nuxt3Bucket = new Bucket(this, "nuxt3Bucket" ,{
      //リソース削除時の挙動を制御。スタックを削除するとバケットも削除
      //だだしバケットの中身があるときはautoDeleteObjectsが true出ないと削除できない
      removalPolicy:RemovalPolicy.DESTROY,
      autoDeleteObjects:true
    });  


    //CloudFrontがS3のオリジンにアクセスするための
    //特別なIDとして機能する『OriginAccessIdentityリソース』（OAI）
    //OAIを持つCloudFront以外はS3以外はS3バケットにアクセスできない
    //この直後にS3origin内に組み込ませる
    const nuxt3Oai = new OriginAccessIdentity(this,"nuxt3Oai");

    //CloudFrontにS3バケットを紐づけるための『S3Origin』
    //あとでCloudFrontのDistributionリソース内に組み込ませる
    const nuxt3BucketOrigin = new S3Orign(nuxt3Bucket,{
      OriginAccessIdentity:nuxt3Oai,
    });

    
    //lambda関数の定義
    const lambda = new Function(this,"nitro",{
      //実行環境を指定
      runtime:Runtime.NODEJS_18_X,
      //lambda関数としてアップロードする関数のディレクトリを指定
      code:Code.fromAsset("../portfolio-nuxt3/.output/server"),
      //実行させる関数の名前をファイル名込みで指定
      handler:"index.handler",
      //タイムアウト時間を指定
      timeoiut:Duration.seconds(5),
      //メモリーサイズを指定
      memorySize:2048,
      //ログの保持を指定
      logRetention:RetentionDays,ONE_MONTH,
    });
    //定義したコンストラクトをaddFunctonUrlでlambda関数URLを定義
    const functionUrl = lambda.addFunctionUrl({
      //認証を必要としないのでNONEを指定
      authType:FunctionUrlAuthType.NONE,
    });

    //CloudFrontにLambda関数URLを紐づけるための『Httporigin』
    //HTTPでアクセス可能なオリジンを紐づけることができるので
    //Lambda関数URL以外でも使うことができる
    const lambdaOrigin = new HttpOrigin(
      //Lambda関数のURLからドメイン部分だけを抽出する
      Fn.select(2,Fn.split("/",functionUrl.url))
    ); 

    //----CloudFront------
      const distribution = new Distribution(this,"cdn",{

        //価格クラス。設定ごとに金と地域が異なる
        PriceClass:PriceClass.PRICE_CLASS_200,

        //デフォルトのビヘイビア。もっとも優先度が低い
        defaultBehavior:{
          //オリジンにLambda関数URLを紐づけたHttpOriginを指定
          origin:lambdaOrigin,

          //すべてのHTTPメソッドを許可
          allowedMethods:AllowedMethods.ALLOW_ALL,

          //オリジンへのリクエスト制御リソース
          originRequestPolicy: new OriginRequestPolicy(
            this,
            "lambdaOriginRequestPolicy",
            {
              //リクエストヘッダを送らない
              headerBehavior:OriginRequestHeaderBehavior.none(),
              //クッキーはすべて送る（ダークモード判定で使用している）
              cookieBehavior:OriginRequestCookieBehavior.all(),
              //クエリパラメータも送る
              queryStringBehavior:OriginRequestQueryStringBehavior.all(),
            }
          ),

          //キャッシュ制御リソース
          cachePolicy:new CachePolicy(this,"lambdaCachePolicy",{
            //サーバー処理はキャッシュさせないのでキャッシュに関するすべてのTTLをゼロにする
            //TTLとはTime to Liveで保持期間のこと
            minTtl:Duration.seconds(0),
            defaultTtl:Duration.seconds(0),
            maxTtl:Duration.seconds(0),
          }),
        },

        //デフォルト以外のビヘイビア。今回は拡張子のある場合にヒットするバスパターン一つのみ定義
        additionalBehavior:{
          //オブジェクトのキーにパスパターンを指定する
          //拡張子を含むパスにヒットさせる意図
          "/*.*":{
            //オリジンにS３バケットのオリジンを指定
            origin:nuxt3BucketOrigin,

            //静的コンテンツの取得なのでPOST等のHTTPメソッドは不要
            allowedMethods:AllowedMethods.GET_HEAD,

            //オリジンへのリクエスト制御リソース
            OriginRequestPolicy: new OriginRequestPolicy(
              this,
              "nuxt3OriginRequestPolicy",
              {
                //単なる静的コンテンツ取得が目的なので、
                //ヘッダやクッキー、クエリパラメータは不要
                headerBehavior:OriginRequestHeaderBehavior.none(),
                cookieBehavior:OriginRequestCookieBehavior.none(),
                queryStringBehavior:OriginRequestQueryStringBehavior.none(),
              }
            ),

            //Lambda側とは異なり、Ｓ３の静的コンテンツはキャッシュさせる
            cachePolicy:new CachePolicy(this,"nuxt3CachePolicy",{
              cookieBehavior:OriginRequestCookieBehavior.none(),
              minTtl:Duration.seconds(1),
              defaultTtl:Duration.seconds(2),
              maxTtl:Duration.seconds(3),
            }),
          },
        },
      });

          //--S3へ静的コンテンツをdeployment
        new BucketDeployment(this,"nuxt3BucketDeployment",{
          //バケットにアップする対象を指定
          sources:[Source.asset("../neo-reshipi/.output/public")],
          //デプロイ先のバケットを指定
          destinationBucket:nuxt3Bucket,
          //ログを保持する期間を指定
          logRetention: RetentionDays,ONE_MONTH,
          //オプションでCloudFrontを指定することで
          //新たにデプロイした際にキャッシュを削除してくれる
          distribution,
        });

        //-------Output------------------
        //デプロイ実行後、生成されたLambda関数URLを出力する
        new CfnOutput(this,"FUNCTION",{
          value:functionUrl.url,
        });
        //デプロイ実行後、生成されたCloudFrontのURLを出力する
        new CfnOutput(this,"CDN",{
          value:`https://${distribution.distributionDomainName}`,
        });


  }
}
