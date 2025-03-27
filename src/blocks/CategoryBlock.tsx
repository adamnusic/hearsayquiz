import { Block, BlockContext, Image, Text, Vstack } from '@devvit/ui';

/**
 * Block for the category selection view of Hear Say game
 */
export const CategoryBlock: Block = (context: BlockContext) => {
  // Get category from context or use a default
  const category = context.data?.category || '';
  
  return (
    <Vstack width="100%" height="100%" gap="medium">
      {/* Background image using Devvit's image component */}
      <Image
        url="hearsay-bg.png"
        imageWidth={800}
        imageHeight={600}
        resizeMode="cover"
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        zIndex={-1}
      />
      
      {/* Content with transparent background to allow the image to show through */}
      <Vstack 
        width="100%" 
        height="100%" 
        gap="large" 
        padding="medium"
        backgroundColor="rgba(0, 0, 0, 0.6)"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="white" size="xxlarge" weight="bold" alignment="center">
          Choose Category
        </Text>
        
        {/* Category buttons would go here */}
        
      </Vstack>
    </Vstack>
  );
}; 