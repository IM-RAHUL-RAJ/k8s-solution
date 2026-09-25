import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class LoginRequestDto {

  @ApiProperty({
    description: 'Username',
    example: 'priya.menon',
    minLength: 3,
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(64)
  username!: string;


  @ApiProperty({
    description: 'Password',
    example: 'correct horse battery staple',
    minLength: 12,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}