import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CliService } from './cli.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })],
  providers: [CliService],
})
export class AppModule {}
